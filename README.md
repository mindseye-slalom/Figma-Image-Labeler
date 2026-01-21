# Display Image Name

Figma/FigJam plugin that creates a 14px black text label containing an image's name and positions it just outside the top-left of the image (so it does not cover the image). The label is grouped with the image so they move together.

Features
- Add label to selected image(s)
- Labels use 14px, color #000000
- Labels are grouped with the image
The plugin attempts to derive the image name from embedded PNG metadata (tEXt/iTXt) when available; otherwise it falls back to the layer name.

Installation
1. In Figma, open Plugins > Development > New Plugin...
2. Choose "Link existing plugin" and point to this folder.
3. The plugin will appear under Plugins > Development.

Usage
- Select a shape that has an image fill (imported image). Click "Add label to selection". A text label will be placed at the top-left and grouped with the image.
 - Labels are placed outside the image at the top-left so they don't cover the image.

Notes & Limitations
- The plugin attempts to load the "Inter" font for the text. If not available, Figma will fallback to a default UI font.
<<<<<<< HEAD
- The plugin stores label metadata as pluginData on the group node.
=======
- The plugin stores label metadata as pluginData on the group node.
>>>>>>> 1fd06ca3cce4a670a4fbe9aba8c6f2a5e7665559
