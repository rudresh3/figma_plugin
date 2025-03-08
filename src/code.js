// Show UI and initialize plugin
figma.showUI(__html__, { width: 300, height: 500 });

// Add a small delay before sending initial frame list to ensure UI is ready
setTimeout(() => {
  console.log('Sending initial frame list');
  sendFrameList();
}, 500); // Increased delay to ensure UI is ready

// Listen for selection changes
figma.on('selectionchange', () => {
  console.log('Selection changed, sending frame list');
  // Add a small delay to ensure the selection is updated
  setTimeout(() => {
    sendFrameList();
  }, 100);
});

// Function to send frame list to UI
function sendFrameList() {
  try {
    // Get selected frames
    const selection = figma.currentPage.selection;
    console.log('Current selection:', selection.length, 'items');

    // Log each selected item's details
    selection.forEach((node, index) => {
      console.log(`Selected item ${index + 1}:`, {
        name: node.name,
        type: node.type,
        id: node.id,
        width: node.width,
        height: node.height
      });
    });

    const frames = selection
      .filter(node => {
        const isFrame = node.type === 'FRAME';
        console.log('Node:', node.name, 'type:', node.type, 'isFrame:', isFrame);
        return isFrame;
      })
      .map(frame => ({
        id: frame.id,
        name: frame.name,
        width: Math.round(frame.width),
        height: Math.round(frame.height)
      }));

    console.log('Filtered frames to send:', frames);

    // Send to UI
    figma.ui.postMessage({
      type: 'frame-list',
      frames: frames
    });
  } catch (error) {
    console.error('Error in sendFrameList:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'Error processing frames: ' + error.message
    });
  }
}

// Base64 encoding characters
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Function to encode bytes to base64
function bytesToBase64(bytes) {
  const len = bytes.length;
  let base64 = '';
  
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    
    for (let j = 0; j < 4; j++) {
      if (i * 8 + j * 6 > len * 8) {
        base64 += '=';
      } else {
        const index = (triplet >> (6 * (3 - j))) & 0x3F;
        base64 += BASE64_CHARS[index];
      }
    }
  }
  
  return base64;
}

// Function to convert frame to base64 image
async function frameToBase64(frame) {
  try {
    // Export frame as PNG
    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });

    // Convert to base64 using our custom function
    return bytesToBase64(bytes);
  } catch (error) {
    console.error('Error converting frame:', error);
    throw error;
  }
}

// Handle messages from UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'refresh-frames') {
    console.log('Refreshing frame list');
    sendFrameList();
  } else if (msg.type === 'convert') {
    try {
      console.log('Converting frames:', msg.frameIds);
      
      // Get frames in the specified order
      const frames = msg.frameIds
        .map(id => figma.getNodeById(id))
        .filter(node => node && node.type === 'FRAME');
      
      if (frames.length === 0) {
        throw new Error('No valid frames found');
      }

      // Convert frames to base64 images
      const images = [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log('Exporting frame:', frame.name);
        
        const bytes = await frame.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 }
        });

        // Use our custom base64 encoder
        const base64 = bytesToBase64(bytes);
        images.push(base64);
      }

      console.log('Sending images to UI:', images.length);
      
      // Send images to UI for GIF creation
      figma.ui.postMessage({
        type: 'frame-images',
        images: images
      });
    } catch (error) {
      console.error('Error during conversion:', error);
      figma.ui.postMessage({
        type: 'error',
        message: 'Error converting frames: ' + error.message
      });
    }
  }
}; 