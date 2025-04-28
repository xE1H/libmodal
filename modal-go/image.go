package modal

// Image represents a Modal image, which can be used to create sandboxes.
type Image struct {
	ImageId string
}

// ImageFromRegistry creates an Image from a registry tag.
func ImageFromRegistry(tag string) (*Image, error) {
	img := &Image{
		ImageId: "im-0MT7lcT3Kzh7DxZgVHgSRY", // TODO: implement registry lookup
	}
	return img, nil
}
