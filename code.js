// Main plugin code
figma.showUI(__html__, { width: 320, height: 200 });

// Utility: try to derive image filename from image bytes (PNG tEXt/iTXt)
async function deriveImageNameFromNode(node) {
    try {
        if (!node || !node.fills) return null;
        const fills = Array.isArray(node.fills) ? node.fills : [];
        const imageFill = fills.find(f => f.type === 'IMAGE');
        if (!imageFill || !imageFill.imageHash) return null;

        const image = figma.getImageByHash(imageFill.imageHash);
        if (!image) return null;

        const bytes = await image.getBytesAsync();
        // Look for PNG text chunks that may contain filename or title
        // PNG tEXt chunks contain ASCII key\0value sequences. We'll do a simple scan.
        const text = String.fromCharCode.apply(null, bytes.slice(0, 2000));
        const keys = ['Title', 'Author', 'Description', 'Filename', 'FileName', 'File name', 'name'];
        for (const key of keys) {
            const idx = text.indexOf(key + '\u0000');
            if (idx !== -1) {
                const start = idx + key.length + 1;
                // read until next null or non-printable
                let value = '';
                for (let i = start; i < text.length; i++) {
                    const ch = text.charCodeAt(i);
                    if (ch === 0 || ch < 9) break;
                    value += text.charAt(i);
                }
                if (value && value.trim().length) return value.trim();
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Utility: create or update label for an image node
async function createLabelForImage(node) {
    if (!node || !('type' in node)) return null;

    // Only handle images (RECTANGLE, ELLIPSE, etc) that have fills with images
    const isImage = (n) => {
        if (!n.fills) return false;
        const fills = Array.isArray(n.fills) ? n.fills : [];
        return fills.some(f => f.type === 'IMAGE');
    };

    if (!isImage(node)) return null;

    // Determine a name for the image. Prefer image metadata (PNG tEXt/iTXt), fallback to imageHash, then node name
    let imageName = null;
    const fills = Array.isArray(node.fills) ? node.fills : [];
    const imageFill = fills.find(f => f && f.type === 'IMAGE');
    if (imageFill && imageFill.imageHash) {
        // Try to extract image name from PNG metadata
        imageName = await deriveImageNameFromNode(node);
    }
    // If no metadata found, fallback to node name
    if (!imageName) {
        // Clean up the node name by removing any trailing numbers and spaces
        imageName = (node.name || 'Image').replace(/\s*\d+\s*$/, '');
    }

    // Create text label
    const text = figma.createText();
    text.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    text.name = 'Image Name Label';

    // Load fonts before setting any text
    try {
        await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
        text.fontName = { family: "Roboto", style: "Regular" };
    } catch (e) {
        try {
            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            text.fontName = { family: "Inter", style: "Regular" };
        } catch (e2) {
            await figma.loadFontAsync({ family: "Arial", style: "Regular" });
            text.fontName = { family: "Arial", style: "Regular" };
        }
    }

    // Now it's safe to set font-dependent properties
    text.fontSize = 14;
    text.characters = imageName;
    // Position outside the image at the top-left
    const containerParent = node.parent || figma.currentPage;

    // Create container first
    const labelContainer = figma.createFrame();
    labelContainer.name = 'Image Name';
    labelContainer.fills = [];
    labelContainer.strokeWeight = 0;
    labelContainer.layoutMode = 'HORIZONTAL';
    labelContainer.counterAxisAlignItems = 'CENTER';
    labelContainer.primaryAxisSizingMode = 'AUTO';
    labelContainer.counterAxisSizingMode = 'AUTO';
    labelContainer.itemSpacing = 4;
    labelContainer.paddingLeft = 4;
    labelContainer.paddingRight = 4;
    labelContainer.paddingTop = 2;
    labelContainer.paddingBottom = 2;

    // Add text to container
    text.x = 0;
    text.y = 0;
    labelContainer.appendChild(text);

    // Add container to parent
    containerParent.appendChild(labelContainer);

    // Get absolute transform positions
    const nodeTransform = node.absoluteTransform;

    // Position at top-left corner, 8px above the image
    labelContainer.x = nodeTransform[0][2];
    labelContainer.y = nodeTransform[1][2] - labelContainer.height - 8;

    // Create group to keep image and label together
    const labelGroup = figma.group([node, labelContainer], containerParent);
    labelGroup.name = imageName + ' Group';

    return labelGroup;

    // Ensure text resize is handled
    text.textAutoResize = "WIDTH_AND_HEIGHT";


    // Store pluginData to track components
    group.setPluginData('labelId', text.id);
    group.setPluginData('toggleId', toggleFrame.id);

    // Set up click handler for the toggle
    toggleFrame.setRelaunchData({ toggle: '' });

    return { group, text };
}

// Helper: find all descendant nodes (including the node itself) that have image fills
function findImageNodes(root) {
    const results = [];
    function visit(n) {
        if (!n) return;
        // Some node types have fills (RECTANGLE, ELLIPSE, VECTOR, FRAME can also have fills)
        if (n.fills && Array.isArray(n.fills)) {
            if (n.fills.some(f => f && f.type === 'IMAGE')) {
                results.push(n);
            }
        }
        if ('children' in n && Array.isArray(n.children)) {
            for (const c of n.children) visit(c);
        }
    }
    visit(root);
    return results;
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'label-selection') {
        // Label the currently selected image(s)
        const selection = figma.currentPage.selection;
        if (!selection || selection.length === 0) {
            figma.notify('Select an image or shape with an image fill first');
            return;
        }

        const imageNodes = [];
        for (const node of selection) {
            // If the selected node itself has an image fill, include it; otherwise search descendants
            const found = findImageNodes(node);
            if (found && found.length) imageNodes.push(...found);
        }

        const created = [];
        for (const imgNode of imageNodes) {
            const result = await createLabelForImage(imgNode);
            if (result) created.push(result);
        }

        if (created.length) {
            const message = created.length === 1
                ? 'Added label to image'
                : `Added labels to ${created.length} images`;
            figma.notify(message);
            figma.ui.postMessage({ type: 'labels-created', count: created.length });
        } else {
            figma.notify('No image fills found in selection');
        }
    }

    if (msg.type === 'toggle-visibility') {
        // Removed toggle visibility feature
    }

    if (msg.type === 'get-selection-info') {
        // Count only nodes with image fills
        const selection = figma.currentPage.selection;
        let imageCount = 0;
        if (selection && selection.length) {
            for (const node of selection) {
                const found = findImageNodes(node);
                if (found && found.length) imageCount += found.length;
            }
        }
        figma.ui.postMessage({ type: 'selection-info', count: imageCount });
    }
    // Send selection info to UI whenever selection changes
    figma.on('selectionchange', () => {
        // Count only nodes with image fills
        const selection = figma.currentPage.selection;
        let imageCount = 0;
        if (selection && selection.length) {
            for (const node of selection) {
                const found = findImageNodes(node);
                if (found && found.length) imageCount += found.length;
            }
        }
        figma.ui.postMessage({ type: 'selection-info', count: imageCount });
    });

    if (msg.type === 'close') {
        figma.closePlugin();
    }
};


