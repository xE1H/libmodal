export class Image {
  readonly imageId: string;

  constructor(imageId: string) {
    this.imageId = imageId;
  }

  static async fromRegistry(tag: string): Promise<Image> {
    return new Image("im-0MT7lcT3Kzh7DxZgVHgSRY"); // TODO
  }
}
