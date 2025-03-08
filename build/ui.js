// Initialize UI
console.log('UI script starting...');

// Create a hidden canvas for image processing
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);
canvas.style.display = 'none';

let selectedFrames = [];

// Function to create an Image from base64 data
function createImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = 'data:image/png;base64,' + base64;
  });
}

// Function to update status
function updateStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    if (isError) {
      statusEl.classList.add('error');
    } else {
      statusEl.classList.remove('error');
    }
  }
}

// Function to update progress bar
function updateProgress(percent) {
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

// Function to show preview
function showPreview(url) {
  const previewContainer = document.getElementById('previewContainer');
  if (!previewContainer) return;

  previewContainer.innerHTML = '';
  const preview = document.createElement('img');
  preview.src = url;
  preview.className = 'gif-preview';
  previewContainer.appendChild(preview);
  previewContainer.style.display = 'block';
}

// Function to create frame item element
function createFrameItem(frame, index) {
  console.log('Creating frame item:', frame);
  const frameEl = document.createElement('div');
  frameEl.className = 'frame-item';
  frameEl.draggable = true;
  frameEl.dataset.index = String(index);
  frameEl.dataset.id = frame.id;
  
  frameEl.innerHTML = `
    <div class="frame-info">
      <div class="frame-name" title="${frame.name}">${frame.name}</div>
      <div class="frame-dimensions" title="Frame dimensions">${frame.width} × ${frame.height}</div>
    </div>
    <div class="frame-drag" title="Drag to reorder">⋮⋮</div>
  `;

  // Add drag and drop handlers
  frameEl.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(index));
    frameEl.classList.add('dragging');
  });

  frameEl.addEventListener('dragend', () => {
    frameEl.classList.remove('dragging');
  });

  frameEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    frameEl.classList.add('drag-over');
  });

  frameEl.addEventListener('dragleave', () => {
    frameEl.classList.remove('drag-over');
  });

  frameEl.addEventListener('drop', (e) => {
    e.preventDefault();
    frameEl.classList.remove('drag-over');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = parseInt(frameEl.dataset.index);
    
    if (fromIndex !== toIndex) {
      const frame = selectedFrames.splice(fromIndex, 1)[0];
      selectedFrames.splice(toIndex, 0, frame);
      updateFramesList(selectedFrames);
    }
  });

  return frameEl;
}

// Function to update frames list
function updateFramesList(frames) {
  console.log('updateFramesList called with:', frames);
  selectedFrames = frames;
  const container = document.getElementById('framesContainer');
  if (!container) {
    console.error('Frames container not found');
    return;
  }

  console.log('Clearing container');
  container.innerHTML = '';
  
  if (!frames || frames.length === 0) {
    console.log('No frames to display');
    container.innerHTML = `
      <div class="frame-item">
        <div class="frame-message">No frames selected. Select frames in Figma first.</div>
      </div>
    `;
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) convertBtn.disabled = true;
    updateStatus('No frames selected');
    return;
  }

  console.log('Adding', frames.length, 'frames to container');
  frames.forEach((frame, index) => {
    if (!frame || !frame.id) {
      console.error('Invalid frame data:', frame);
      return;
    }

    const frameEl = createFrameItem(frame, index);
    container.appendChild(frameEl);
    console.log('Added frame element:', frame.name);
  });

  const convertBtn = document.getElementById('convertBtn');
  if (convertBtn) {
    convertBtn.disabled = false;
    console.log('Convert button enabled');
  }
  updateStatus(frames.length + ' frame' + (frames.length > 1 ? 's' : '') + ' selected');
}

// Function to create GIF from frames
async function createGif(frames) {
  try {
    updateStatus('Creating GIF...');
    updateProgress(0);
    
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: window.gifWorkerUrl
    });

    const frameDelay = parseInt(document.getElementById('frameDelay').value);

    // Add frames with progress tracking
    frames.forEach((frame, index) => {
      gif.addFrame(frame, { delay: frameDelay });
      updateStatus(`Adding frame ${index + 1}/${frames.length}`);
      updateProgress((index + 1) / frames.length * 50);
    });
    
    // Wait for GIF to be created
    return new Promise((resolve, reject) => {
      gif.on('finished', function(blob) {
        updateStatus('Processing completed GIF...');
        updateProgress(90);
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = function() {
          if (reader.result) {
            const base64data = reader.result.split(',')[1];
            parent.postMessage({ 
              pluginMessage: { 
                type: 'gif-data',
                data: base64data
              }
            }, '*');
            updateProgress(100);
            resolve();
          } else {
            reject(new Error('Failed to read GIF data'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read GIF blob'));
        reader.readAsDataURL(blob);
      });

      gif.on('progress', (progress) => {
        updateProgress(50 + progress * 40);
      });

      updateStatus('Rendering GIF...');
      gif.render();
    });
  } catch (error) {
    updateStatus('Error: ' + error.message, true);
    updateProgress(0);
    parent.postMessage({ 
      pluginMessage: { 
        type: 'error',
        message: error.message
      }
    }, '*');
  }
}

// Handle messages from the plugin
window.onmessage = function(event) {
  console.log('Message received in UI:', event);
  
  // Ensure we have plugin message data
  if (!event.data || !event.data.pluginMessage) {
    console.log('No plugin message data');
    return;
  }
  
  const msg = event.data.pluginMessage;
  console.log('Processing plugin message:', msg);
  
  if (msg.type === 'frame-list') {
    console.log('Received frame list:', msg.frames);
    if (!Array.isArray(msg.frames)) {
      console.error('Invalid frames data:', msg.frames);
      updateStatus('Error: Invalid frame data received', true);
      return;
    }
    updateFramesList(msg.frames);
  } else if (msg.type === 'process-frames') {
    console.log('Processing frames for GIF:', msg.frames.length);
    updateStatus('Received ' + msg.frames.length + ' frames for processing');
    createGif(msg.frames);
  } else if (msg.type === 'error') {
    console.error('Error from plugin:', msg.message);
    updateStatus(msg.message, true);
    updateProgress(0);
  } else if (msg.type === 'success') {
    console.log('Success message received');
    const blob = new Blob([msg.data], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    updateStatus('Conversion completed!');
    showPreview(url);
    
    // Create download link
    const statusEl = document.getElementById('status');
    if (statusEl) {
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'animation.gif';
      downloadLink.textContent = 'Download GIF';
      downloadLink.className = 'download-link';
      statusEl.appendChild(document.createElement('br'));
      statusEl.appendChild(downloadLink);
    }
  } else {
    console.warn('Unknown message type:', msg.type);
  }
};

// Initialize UI elements
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, setting up event listeners...');
  
  // Handle refresh button click
  const refreshBtn = document.getElementById('refreshFrames');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('Refresh button clicked');
      parent.postMessage({ pluginMessage: { type: 'refresh-frames' } }, '*');
    });
  }

  // Handle convert button click
  const convertBtn = document.getElementById('convertBtn');
  if (convertBtn) {
    convertBtn.addEventListener('click', () => {
      console.log('Convert button clicked');
      const format = document.getElementById('formatSelect').value;
      const frameDelay = parseInt(document.getElementById('frameDelay').value);
      
      updateStatus('Starting conversion...');
      updateProgress(0);
      
      parent.postMessage({
        pluginMessage: {
          type: 'convert',
          format,
          frameDelay,
          frameIds: selectedFrames.map(f => f.id)
        }
      }, '*');
    });
  }

  console.log('UI initialization complete');
}); 