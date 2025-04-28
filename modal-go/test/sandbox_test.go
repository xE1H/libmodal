package test

import (
	"context"
	"io"
	"testing"

	"github.com/modal-labs/libmodal/modal-go"
	"github.com/onsi/gomega"
)

func TestCreateOneSandbox(t *testing.T) {
	t.Parallel()
	g := gomega.NewWithT(t)
	app, err := modal.AppLookup(context.Background(), "libmodal-test", modal.LookupOptions{CreateIfMissing: true})
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	image, err := app.ImageFromRegistry("alpine:3.21")
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	sb, err := app.CreateSandbox(image, modal.SandboxOptions{})
	g.Expect(err).ShouldNot(gomega.HaveOccurred())
	g.Expect(sb.SandboxId).ShouldNot(gomega.BeEmpty())

	err = sb.Terminate()
	g.Expect(err).ShouldNot(gomega.HaveOccurred())
}

func TestPassCatToStdin(t *testing.T) {
	t.Parallel()
	g := gomega.NewWithT(t)
	app, err := modal.AppLookup(context.Background(), "libmodal-test", modal.LookupOptions{CreateIfMissing: true})
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	image, err := app.ImageFromRegistry("alpine:3.21")
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	// Spawn a sandbox running the "cat" command.
	sb, err := app.CreateSandbox(image, modal.SandboxOptions{Command: []string{"cat"}})
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	// Write to the sandbox's stdin and read from its stdout.
	_, err = sb.Stdin.Write([]byte("this is input that should be mirrored by cat"))
	g.Expect(err).ShouldNot(gomega.HaveOccurred())
	err = sb.Stdin.Close()
	g.Expect(err).ShouldNot(gomega.HaveOccurred())

	output, err := io.ReadAll(sb.Stdout)
	g.Expect(err).ShouldNot(gomega.HaveOccurred())
	g.Expect(string(output)).To(gomega.Equal("this is input that should be mirrored by cat"))

	// Terminate the sandbox.
	err = sb.Terminate()
	g.Expect(err).ShouldNot(gomega.HaveOccurred())
}
