class PlayloguePcmRecorder extends AudioWorkletProcessor{process(inputs){const samples=inputs[0]?.[0];if(samples?.length)this.port.postMessage(samples.slice().buffer);return true;}}
registerProcessor('playlogue-pcm-recorder',PlayloguePcmRecorder);
