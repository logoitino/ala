export type HighlightClip = {
  id: string;
  athleteName: string;
  school: string;
  tag: string;
  videoUrl: string;
  sekiPlay?: boolean;
};

export const HIGHLIGHT_CLIPS: HighlightClip[] = [
  {
    id: 'hl-1',
    athleteName: 'Marcus Rivera',
    school: 'ALA Hawks',
    tag: 'Touchdown',
    sekiPlay: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    id: 'hl-2',
    athleteName: 'Jordan Blake',
    school: 'ALA Hawks',
    tag: 'Breakaway',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  },
  {
    id: 'hl-3',
    athleteName: 'Tyler Nguyen',
    school: 'Westlake',
    tag: 'One-handed grab',
    sekiPlay: true,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  },
  {
    id: 'hl-4',
    athleteName: 'Derek Sullivan',
    school: 'Lone Peak',
    tag: 'Sack',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  },
  {
    id: 'hl-5',
    athleteName: 'Andre Coleman',
    school: 'Skyridge',
    tag: 'Chase-down',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  },
];
