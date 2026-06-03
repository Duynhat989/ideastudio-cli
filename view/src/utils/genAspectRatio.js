const IMAGE_RATIO_CSS = {
  IMAGE_ASPECT_RATIO_LANDSCAPE: '16 / 9',
  IMAGE_ASPECT_RATIO_PORTRAIT: '9 / 16',
  IMAGE_ASPECT_RATIO_SQUARE: '1 / 1',
  IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE: '4 / 3',
  IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR: '3 / 4',
};

const VIDEO_RATIO_CSS = {
  VIDEO_ASPECT_RATIO_LANDSCAPE: '16 / 9',
  VIDEO_ASPECT_RATIO_PORTRAIT: '9 / 16',
};

export function imageAspectToCss(value) {
  return IMAGE_RATIO_CSS[value] || '16 / 9';
}

export function videoAspectToCss(value) {
  return VIDEO_RATIO_CSS[value] || '16 / 9';
}
