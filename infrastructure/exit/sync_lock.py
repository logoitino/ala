"""Hold a private OS advisory lock until the Node owner's pipe closes; crashes release it automatically."""
import fcntl
import os
import stat
import sys


def main():
    lock_path = sys.argv[1]
    descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
            raise RuntimeError("Exit sync lock must be a private owned regular file")
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError("Another exit sync is running") from exc
        print("locked", flush=True)
        sys.stdin.buffer.read()
    finally:
        os.close(descriptor)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
