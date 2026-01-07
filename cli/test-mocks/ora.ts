export default function ora() {
  return {
    start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
    succeed: () => {},
    fail: () => {},
    stop: () => {},
    text: '',
  } as any;
}

