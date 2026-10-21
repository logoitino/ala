#!/usr/bin/env node
/** Offline, labelled synthetic upload fixtures. Native media is verified before manifest claims; existing output is never overwritten. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, basename, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const VIDEO_LIMIT = 8 * 1024 * 1024;

/** Resolve parent symlinks before enforcing the outside-repository/no-overwrite boundary. */
export function prepareOutputPath(value, repoRoot = repository) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Provide --out DIRECTORY outside the repository.');
  const requested = resolve(value);
  if (existsSync(requested)) throw new Error('Output already exists; choose a new directory.');
  // lstat also rejects dangling symlinks, which existsSync cannot see.
  try { lstatSync(requested); throw new Error('Output already exists; choose a new directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const parent = realpathSync(dirname(requested));
  const output = join(parent, basename(requested));
  const inside = relative(realpathSync(repoRoot), output);
  if (!inside || (!inside.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && inside !== '..' && !isAbsolute(inside))) {
    throw new Error('Output must be outside the repository.');
  }
  return output;
}

/** Standard ISO BMFF free box padding preserves the original MP4; it is not random trailing bytes. */
export function makeFreeBox(payloadBytes) {
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0 || payloadBytes > 64 * 1024 * 1024) {
    throw new Error('Invalid bounded free-box size.');
  }
  const box = Buffer.alloc(payloadBytes + 8);
  box.writeUInt32BE(box.length, 0);
  box.write('free', 4, 4, 'ascii');
  return box;
}

const swiftSource = String.raw`
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers
import AVFoundation
import CoreVideo
import CoreMedia

let output = CommandLine.arguments[1]
var files: [[String: Any]] = []
var failures: [[String: String]] = []
func issue(_ stage: String, _ error: Error) { failures.append(["stage": stage, "message": String(describing: error)]) }
struct FixtureError: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = message }
}
func label(_ context: CGContext, _ text: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat) {
    let font = CTFontCreateWithName("Helvetica-Bold" as CFString, size, nil)
    let attrs = [kCTFontAttributeName: font, kCTForegroundColorAttributeName: CGColor(gray: 1, alpha: 1)] as CFDictionary
    let line = CTLineCreateWithAttributedString(CFAttributedStringCreate(nil, text as CFString, attrs)!)
    context.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, context)
}
func draw(_ context: CGContext, _ width: Int, _ height: Int, _ index: Int, _ progress: Double = 0) {
    let w = CGFloat(width), h = CGFloat(height)
    let red = CGFloat(0.10 + Double(index % 5) * 0.13)
    let green = CGFloat(0.20 + Double(index % 3) * 0.15)
    context.setFillColor(CGColor(red: red, green: green, blue: 0.35, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: w, height: h))
    context.setFillColor(CGColor(red: 0.92, green: 0.72, blue: 0.25, alpha: 1))
    for n in 0..<5 {
        let edge = w * CGFloat(n + 1) / 12
        context.fillEllipse(in: CGRect(x: edge + CGFloat(progress) * w * 0.15, y: h * 0.28 + CGFloat(n % 2) * h * 0.12, width: edge, height: edge))
    }
    context.setFillColor(CGColor(gray: 0.05, alpha: 1))
    context.fill(CGRect(x: 0, y: h * 0.70, width: w, height: h * 0.3))
    label(context, "SYNTHETIC APP TEST", w * 0.05, h * 0.88, w * 0.06)
    label(context, String(format: "FIXTURE %02d - NO REAL PEOPLE", index), w * 0.05, h * 0.78, w * 0.04)
}
func jpeg(_ index: Int) throws {
    let width = 1080, height = 1350
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        throw FixtureError("CoreGraphics could not create JPEG drawing context")
    }
    draw(context, width, height, index)
    guard let image = context.makeImage() else { throw FixtureError("Could not make fixture image") }
    let name = String(format: "synthetic-story-%02d.jpg", index)
    let url = URL(fileURLWithPath: output).appendingPathComponent(name)
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
        throw FixtureError("ImageIO could not create JPEG destination")
    }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
    guard CGImageDestinationFinalize(destination), let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          CGImageSourceGetType(source) as String? == UTType.jpeg.identifier,
          CGImageSourceGetCount(source) == 1, let decoded = CGImageSourceCreateImageAtIndex(source, 0, nil),
          decoded.width == width, decoded.height == height else { throw FixtureError("JPEG native decode/type verification failed") }
    files.append(["filename": name, "kind": "jpeg", "nativeType": "public.jpeg", "width": width, "height": height, "frames": 1])
}
func verifyVideo(_ name: String, _ seconds: Int, _ fps: Int) async throws -> [String: Any] {
    let url = URL(fileURLWithPath: output).appendingPathComponent(name)
    let asset = AVURLAsset(url: url)
    let tracks = try await asset.loadTracks(withMediaType: .video)
    guard let track = tracks.first else { throw FixtureError("No native video track") }
    let formats = try await track.load(.formatDescriptions)
    guard let format = formats.first,
          CMFormatDescriptionGetMediaSubType(format) == kCMVideoCodecType_H264 else { throw FixtureError("No native H.264 video track") }
    let duration = CMTimeGetSeconds(try await asset.load(.duration))
    let size = try await track.load(.naturalSize)
    guard duration.isFinite && abs(duration - Double(seconds)) < 0.10 else { throw FixtureError("Unexpected native video duration: \(duration)") }
    let reader = try AVAssetReader(asset: asset)
    let framesOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(framesOutput)
    guard reader.startReading() else { throw FixtureError("Native video decode failed: \(String(describing: reader.error))") }
    var count = 0
    while let sample = framesOutput.copyNextSampleBuffer() {
        guard CMSampleBufferGetImageBuffer(sample) != nil else { throw FixtureError("A video frame could not decode") }
        count += 1
    }
    guard reader.status == .completed && count == seconds * fps else { throw FixtureError("Native decoded frame count \(count) expected \(seconds * fps): \(String(describing: reader.error))") }
    return ["filename": name, "kind": "mp4", "nativeType": "public.mpeg-4", "codec": "H.264", "durationSeconds": duration,
            "frames": count, "fps": fps, "width": Int(size.width), "height": Int(size.height)]
}
func video(_ seconds: Int) async throws {
    let width = 480, height = 360, fps: Int32 = 12
    let name = "synthetic-video-\(seconds)s.mp4"
    let url = URL(fileURLWithPath: output).appendingPathComponent(name)
    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width, AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 350000, AVVideoExpectedSourceFrameRateKey: fps]])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height, kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
    guard writer.canAdd(input) else { throw FixtureError("Native H.264 writer input unsupported") }
    writer.add(input)
    guard writer.startWriting() else { throw FixtureError("Native H.264 start blocked: \(String(describing: writer.error))") }
    writer.startSession(atSourceTime: .zero)
    let deadline = Date().addingTimeInterval(90)
    for n in 0..<(seconds * Int(fps)) {
        while !input.isReadyForMoreMediaData {
            guard writer.status == .writing && Date() < deadline else { writer.cancelWriting(); throw FixtureError("H.264 writer stalled or failed: \(String(describing: writer.error))") }
            Thread.sleep(forTimeInterval: 0.002)
        }
        var buffer: CVPixelBuffer?
        guard CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB,
                                 [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary,
                                 &buffer) == kCVReturnSuccess, let pixel = buffer else { writer.cancelWriting(); throw FixtureError("Could not create video frame") }
        CVPixelBufferLockBaseAddress(pixel, [])
        guard let context = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else {
            CVPixelBufferUnlockBaseAddress(pixel, []); writer.cancelWriting(); throw FixtureError("Could not draw video frame")
        }
        draw(context, width, height, seconds, Double(n) / Double(seconds * Int(fps)))
        label(context, "\(seconds)s TEST - FRAME \(n + 1)", 24, 32, 16)
        CVPixelBufferUnlockBaseAddress(pixel, [])
        guard adaptor.append(pixel, withPresentationTime: CMTime(value: Int64(n), timescale: fps)) else {
            writer.cancelWriting(); throw FixtureError("Native H.264 append blocked: \(String(describing: writer.error))")
        }
    }
    writer.endSession(atSourceTime: CMTime(value: Int64(seconds), timescale: 1))
    input.markAsFinished()
    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    guard done.wait(timeout: .now() + 30) == .success && writer.status == .completed else { writer.cancelWriting(); throw FixtureError("H.264 finish failed: \(String(describing: writer.error))") }
    files.append(try await verifyVideo(name, seconds, Int(fps)))
}
if CommandLine.arguments.count > 2 && CommandLine.arguments[2] == "verify-oversize" {
    do { files.append(try await verifyVideo("synthetic-video-8s-over-8MiB.mp4", 8, 12)) } catch { issue("oversize-native-verification", error) }
} else {
    for index in 1...10 { do { try jpeg(index) } catch { issue("jpeg-\(index)", error) } }
    for seconds in [8, 46] { do { try await video(seconds) } catch { issue("h264-\(seconds)s", error) } }
}
let result: [String: Any] = ["files": files, "failures": failures]
let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: json, encoding: .utf8)!)
`;

function runSwift(script, output, mode) {
  const run = spawnSync('/usr/bin/swift', ['-module-cache-path', join(dirname(script), 'module-cache'), script, output, ...(mode ? [mode] : [])], {
    encoding: 'utf8', timeout: 240000, maxBuffer: 2 * 1024 * 1024,
  });
  if (run.error || run.status !== 0) {
    const diagnostic = run.stderr.split('\n').filter((line) => /error:/.test(line)).join('\n') || run.stderr.trim().slice(-3500);
    throw new Error(`Swift media tool failed: ${run.error?.message ?? diagnostic}`);
  }
  try { return JSON.parse(run.stdout.trim()); }
  catch { throw new Error('Swift did not return a native verification report.'); }
}

export function generateFixtures(out) {
  const started = Date.now();
  const output = prepareOutputPath(out);
  if (process.platform !== 'darwin' || !existsSync('/usr/bin/swift')) {
    throw new Error('Native fixture creation requires macOS, Xcode Command Line Tools (/usr/bin/swift), and ImageIO/AVFoundation H.264 support. No media was created.');
  }
  mkdirSync(output, { mode: 0o700 }); // Atomic creation; a concurrent existing path is refused.
  const temporary = mkdtempSync(join(tmpdir(), 'ala-media-fixtures-'));
  const script = join(temporary, 'fixtures.swift');
  const files = [];
  const failures = [];
  try {
    writeFileSync(script, swiftSource, { flag: 'wx', mode: 0o600 });
    try {
      const report = runSwift(script, output);
      files.push(...report.files); failures.push(...report.failures);
    } catch (error) { failures.push({ stage: 'native-generation', message: error.message }); }
    const short = files.find((file) => file.filename === 'synthetic-video-8s.mp4');
    if (short) {
      const paddedName = 'synthetic-video-8s-over-8MiB.mp4';
      const paddedPath = join(output, paddedName);
      const original = readFileSync(join(output, short.filename));
      writeFileSync(paddedPath, original, { flag: 'wx', mode: 0o600 });
      appendFileSync(paddedPath, makeFreeBox(Math.max(0, VIDEO_LIMIT + 1 - original.length - 8)));
      try {
        const report = runSwift(script, output, 'verify-oversize');
        files.push(...report.files.map((file) => ({ ...file, negativeCase: 'file-over-8MiB', freeBoxPadding: true })));
        failures.push(...report.failures);
      } catch (error) { failures.push({ stage: 'oversize-native-verification', message: error.message }); }
    } else failures.push({ stage: 'oversize-fixture', message: 'A verified short MP4 was unavailable; no valid oversize MP4 can be claimed.' });
    for (const file of files) {
      const bytes = readFileSync(join(output, file.filename));
      file.bytes = bytes.length;
      file.sha256 = createHash('sha256').update(bytes).digest('hex');
      if (file.filename === 'synthetic-video-46s.mp4') file.negativeCase = 'duration-over-45s';
    }
    // Native failures may leave incomplete files. They are never listed as verified media.
    const status = failures.length === 0 && files.length === 13 ? 'complete' : 'partial';
    const manifest = { version: 1, status, syntheticOnly: true, containsRealPeople: false,
      createdAt: new Date().toISOString(), elapsedSeconds: (Date.now() - started) / 1000,
      prerequisites: 'macOS + Xcode Command Line Tools + native JPEG/H.264 encoding and decoding',
      purpose: 'Local current-app upload testing; 46s and oversize videos are rejection fixtures, not enabled upload policy.', files, failures };
    writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return { output, manifest };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/media-test-assets.mjs --out NEW_DIRECTORY_OUTSIDE_REPO\nCreates ten labelled JPEGs, 8s/46s H.264 MP4s and a valid over-8MiB MP4. macOS native tools required. Existing output is refused; partial native failures exit 1.');
  } else {
    try {
      if (args.length !== 2 || args[0] !== '--out') throw new Error('Usage: node scripts/media-test-assets.mjs --out NEW_DIRECTORY_OUTSIDE_REPO');
      const { output, manifest } = generateFixtures(args[1]);
      console.log(JSON.stringify({ output, status: manifest.status, verifiedFiles: manifest.files.length, elapsedSeconds: manifest.elapsedSeconds, failures: manifest.failures }, null, 2));
      if (manifest.status !== 'complete') process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
