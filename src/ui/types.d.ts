declare class GIF {
  constructor(options: {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
  });

  addFrame(imageData: ImageData, options?: { delay?: number }): void;
  on(event: 'finished' | 'progress', callback: ((blob: Blob) => void) | ((progress: number) => void)): void;
  render(): void;
} 