const BUFFER_SIZE = 8192;

class AudioPlayer {
  constructor({emitter, pitch, tempo}) {
      this.emitter = emitter;

      this.context = new AudioContext();

      this.scriptProcessor = this.context.createScriptProcessor(BUFFER_SIZE, 2, 2);
      this.scriptProcessor.onaudioprocess = e => {
          const l = e.outputBuffer.getChannelData(0);
          const r = e.outputBuffer.getChannelData(1);
          const framesExtracted = this.simpleFilter.extract(this.samples, BUFFER_SIZE);
          if (framesExtracted === 0) {
              this.emitter.emit('stop');
          }
          for (let i = 0; i < framesExtracted; i++) {
              l[i] = this.samples[i * 2];
              r[i] = this.samples[i * 2 + 1];
          }
      };
     
      this.soundTouch = new SoundTouch();
      this.soundTouch.pitch = pitch;
      this.soundTouch.tempo = tempo;
      
      this.duration = undefined;
        
        this.volumeNode = this.context.createGain();
        this.volumeNode.gain.value = 0.5;
        
  }

  get pitch() {
      return this.soundTouch.pitch;
  }
  set pitch(pitch) {
      this.soundTouch.pitch = pitch;
  }

  get tempo() {
      return this.soundTouch.tempo;
  }
  set tempo(tempo) {
      this.soundTouch.tempo = tempo;
  }

  decodeAudioData(data) {
      return this.context.decodeAudioData(data);
  }

  setBuffer(buffer) {
      const bufferSource = this.context.createBufferSource();
      bufferSource.buffer = buffer;

      this.samples = new Float32Array(BUFFER_SIZE * 2);
      this.source = {
          extract: (target, numFrames, position) => {
              this.emitter.emit('state', {t: position / this.context.sampleRate});
              const l = buffer.getChannelData(0);
              const r = buffer.getChannelData(1);
              for (let i = 0; i < numFrames; i++) {
                  target[i * 2] = l[i + position];
                  target[i * 2 + 1] = r[i + position];
              }
              return Math.min(numFrames, l.length - position);
          },
      };
      this.simpleFilter = new SimpleFilter(this.source, this.soundTouch);

      this.duration = buffer.duration;
      this.emitter.emit('state', {duration: buffer.duration});
  }



play() {
      this.scriptProcessor.connect(this.volumeNode);
      this.volumeNode.connect(this.context.destination)
}


pause() {
    this.scriptProcessor.disconnect(this.volumeNode);
    this.volumeNode.disconnect(this.context.destination);
}


get durationVal(){
    return this.simpleFilter.sourcePosition;
}

  seekPercent(percent) {
      if (this.simpleFilter !== undefined) {
          this.simpleFilter.sourcePosition = Math.round(
              percent / 100 * this.duration * this.context.sampleRate
          );
      }
  }
}

const fileInput = document.getElementById('fileInput');
const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const tempoSlider = document.getElementById('tempoSlider');
const pitchSlider = document.getElementById('pitchSlider');
const seekSlider = document.getElementById('seekSlider');
const currentTimeDisplay = document.getElementById('currentTime');

let myInterval;

let isPlaying = false;

let audioPlayer;


fileInput.addEventListener('change', async (e, impulse) => {
    if(audioPlayer){
        if(isPlaying){
            audioPlayer.pause();
            isPlaying = false;
            audioPlayer = undefined;
        }
        else if(!isPlaying){
            audioPlayer = undefined;
        }
    };

    const file = e.target.files[0];
    if (!file) return;
    
    audioPlayer = new AudioPlayer({
        emitter: {
            emit: () => {},
        },
        pitch: pitchSlider.value,
        tempo: tempoSlider.value
    });

    try {
        const response = await fetch(URL.createObjectURL(file));
        const buffer = await response.arrayBuffer();
        const audioData = await audioPlayer.decodeAudioData(buffer);
        audioPlayer.setBuffer(audioData);

        audioPlayer.play();
        isPlaying = true;

        myInterval = setInterval(()=>{
            updateSeek(audioPlayer, seekSlider);
        }, 1000);

    } catch (error) {
        console.error(error);
    }

});



function updateSeek(audioPlayer, seekSlider) {
    if(audioPlayer){
        console.log("seeking");
        let sourcePostion = audioPlayer.durationVal;
        seekSlider.value = sourcePostion / 48000 / audioPlayer.duration;
    }
}

playButton.addEventListener('click', () => {
    if (!audioPlayer) return;
    if(!isPlaying){
        audioPlayer.play();
        isPlaying = true;
        myInterval = setInterval(()=>{
            updateSeek(audioPlayer, seekSlider);
        }, 1000);
    }
});

pauseButton.addEventListener('click', () => {
    if (!audioPlayer) return;
    if(isPlaying){
        audioPlayer.pause();
        isPlaying = false;
        clearInterval(myInterval);
    }
});


tempoSlider.addEventListener('input', () => {
    if (audioPlayer) {
        audioPlayer.tempo = tempoSlider.value;
    }
});

pitchSlider.addEventListener('input', () => {
    if (audioPlayer) {
        audioPlayer.pitch = pitchSlider.value;
    }
});


seekSlider.addEventListener('input', ()=>{
    let percentage = seekSlider.value * 100;
    if(audioPlayer){
        audioPlayer.seekPercent(percentage);
    }
})