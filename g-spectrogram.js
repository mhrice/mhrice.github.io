// Assumes context is an AudioContext defined outside of this class.

Polymer('g-spectrogram', {
  // Show the controls UI.
  controls: false,
  // Log mode.
  log: false,
  // Show axis labels, and how many ticks.
  labels: false,
  ticks: 5,
  speed: 2,
  // FFT bin size,
  fftsize: 16384,
  oscillator: false,
  color: false,
  pause: false,
  resolutionMax: 20000,
  resolutionMin: 100,
  gain: 6,

  attachedCallback: function() {
    this.tempCanvas = document.createElement('canvas'),
    console.log('Created spectrogram');
    // Get input from the microphone.
    if (navigator.mozGetUserMedia) {
      navigator.mozGetUserMedia({audio: true},
                                this.onStream.bind(this),
                                this.onStreamError.bind(this));
    } else if (navigator.webkitGetUserMedia) {
      navigator.webkitGetUserMedia({audio: true},
                                this.onStream.bind(this),
                                this.onStreamError.bind(this));
    }
    this.ctx = this.$.canvas.getContext('2d');
  },

  render: function() {
    //console.log('Render');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    var didResize = false;
    // Ensure dimensions are accurate.
    if (this.$.canvas.width != this.width) {
      this.$.canvas.width = this.width;
      this.$.labels.width = this.width;
      didResize = true;
    }
    if (this.$.canvas.height != this.height) {
      this.$.canvas.height = this.height;
      this.$.labels.height = this.height;
      didResize = true;
    }

    //this.renderTimeDomain();
    this.renderFreqDomain();

    if (this.labels && didResize) {
      this.renderAxesLabels();
    }

    requestAnimationFrame(this.render.bind(this));

    var now = new Date();
    if (this.lastRenderTime_) {
      this.instantaneousFPS = now - this.lastRenderTime_;
    }
    this.lastRenderTime_ = now;


    this.gainNode.gain.value = this.setGain(this.gain);

  },

  renderTimeDomain: function() {
    var times = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(times);

    for (var i = 0; i < times.length; i++) {
      var value = times[i];
      var percent = value / 256;
      var barHeight = this.height * percent;
      var offset = this.height - barHeight - 1;
      var barWidth = this.width/times.length;
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(i * barWidth, offset, 1, 1);
    }
  },

  renderFreqDomain: function() {
    var freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freq);
    var ctx = this.ctx;
    // Copy the current canvas onto the temp canvas.
    this.tempCanvas.width = this.width;
    this.tempCanvas.height = this.height;
    //console.log(this.$.canvas.height, this.tempCanvas.height);
    var tempCtx = this.tempCanvas.getContext('2d');
    tempCtx.drawImage(this.$.canvas, 0, 0, this.width, this.height);
    // Iterate over the frequencies.
    var resolutionMaxPercent = this.resolutionMax/(context.sampleRate/2);
    var resolutionMinPercent = Number(this.resolutionMin)/(context.sampleRate/2);
    var maxSample = Math.round(freq.length * resolutionMaxPercent);
    var minSample = Math.round(freq.length * resolutionMinPercent);


    for (var i = 0; i < maxSample-minSample; i++) {
      var value;
      // Draw each pixel with the specific color.



      if (this.log) {
        logIndex = this.logScale(i, (maxSample));
        value = freq[logIndex+minSample];

      } else {
        value = freq[i];
      }

      ctx.fillStyle = (this.color ? this.getFullColor(value) : this.getGrayColor(value));

      var percent = i / (maxSample-minSample);
      var y = Math.round(percent * this.height);


      // draw the line at the right side of the canvas
      ctx.fillRect(this.width - this.speed, this.height - y,
                   this.speed, this.speed);
    }

    // Translate the canvas.
    ctx.translate(-this.speed, 0);
    // Draw the copied image.
    ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height,
                  0, 0, this.width, this.height);

    // Reset the transformation matrix.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
/**
* Takes the linear gain slider position and converts it to a logarithmic scale
*/
  setGain: function(position){
        var minp = 1;
        var maxp = 10;
        var minVal = Math.log(0.1);
        var maxVal = Math.log(10);
        var scale = (maxVal-minVal) / (maxp-minp);
        return Math.exp(minVal + scale*(position-minp));
  },
  /**
   * Given an index and the total number of entries, return the
   * log-scaled value.
   */
  logScale: function(index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = this.logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
  },

  logBase: function(val, base) {
    return Math.log(val) / Math.log(base);
  },

  renderAxesLabels: function() {
    var canvas = this.$.labels;
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    var startFreq = 440;
    startFreq = this.resolutionMin;
    var nyquist = context.sampleRate/2;
    var endFreq = this.resolutionMax - startFreq;
    var step = (endFreq - startFreq) / this.ticks;
    var yLabelOffset = 5;

    var resolutionMaxPercent = this.resolutionMax/(context.sampleRate/2);
    var resolutionMinPercent = Number(this.resolutionMin)/(context.sampleRate/2);
    var maxSample = Math.round(this.getFFTBinCount() * resolutionMaxPercent);
    var minSample = Math.round(this.getFFTBinCount() * resolutionMinPercent);
    // Render the vertical frequency axis.

    for (var i = 0; i <= this.ticks; i++) {

      //Inital Vals = 100, 161, 403, 1366, 4967, 19000
      var freq = startFreq + (step * i);
      // Get the y coordinate from the current label.
      var index = this.freqToIndex(freq);


      var percent  = i/(this.ticks);
      var y = (1-percent) * this.height;

      var x = this.width - 60;
      // Get the value for the current y coordinate.
      var label;
      if (this.log) {

        // Handle a logarithmic scale.
        // var logIndex = this.logScale(index, maxSample)+minSample;


        // Never show 0 Hz.

        // freq = Math.max(1, this.indexToFreq(logIndex));

        freq = Math.max(1,this.getFrequencies(i));

      }
      var label = this.formatFreq(freq);
      var units = this.formatUnits(freq);
      ctx.font = '16px Inconsolata';
      // Draw the value.
      ctx.textAlign = 'right';
      ctx.fillText(label, x, y + yLabelOffset);
      // Draw the units.
      ctx.textAlign = 'left';
      ctx.fillText(units, x + 10, y + yLabelOffset);
      // Draw a tick mark.
      ctx.fillRect(x + 40, y, 30, 2);
    }

  },

/**
* For each tick, grab the log-scaled frequency value
*/
  getFrequencies(index){
    var percent = ((index/this.ticks));
      percent = this.logScale_(percent * 1000, 1000) / 1000;

    return Math.round(percent * (this.resolutionMax - Number(this.resolutionMin)) + Number(this.resolutionMin));
  },

  clearAxesLabels: function() {
    var canvas = this.$.labels;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);
  },

  formatFreq: function(freq) {
    return (freq >= 1000 ? (freq/1000).toFixed(1) : Math.round(freq));
  },

  formatUnits: function(freq) {
    return (freq >= 1000 ? 'KHz' : 'Hz');
  },

  indexToFreq: function(index) {
    var nyquist = context.sampleRate/2;
    return nyquist/this.getFFTBinCount() * index;
  },

  freqToIndex: function(frequency) {
    var nyquist = context.sampleRate/2;
    return Math.round(frequency/nyquist * this.getFFTBinCount());
  },

  getFFTBinCount: function() {
    return this.fftsize / 2;
  },

  onStream: function(stream) {
    var input = context.createMediaStreamSource(stream);
    var gainNode = context.createGain();
    var analyser = context.createAnalyser();

    analyser.minDecibels = -100;
    analyser.maxDecibels = -20;
    analyser.smoothingTimeConstant = 0;
    // analyser.fftSize = this.fftsize;
    var fftSize = 16384;
    analyser.fftSize = fftSize;

    // Connect graph.
    input.connect(gainNode);
    gainNode.connect(analyser);
    // input.connect(analyser);
    this.gainNode = gainNode;
    this.analyser = analyser;

    gainNode.gain.value = 1;

    // Setup a timer to visualize some stuff.
    this.render();
  },

  onStreamError: function(e) {
    console.error(e);
  },

  getGrayColor: function(value) {
    var fromH = 235;
    var toH = 1;
    var percent = value / 255;
    var delta = percent * (toH - fromH);
    var hue = fromH + delta;


    // Test Max
    if(value ==255) {
      console.log("MAX!");
    }


    return 'hsl(H, 100%, 50%)'.replace(/H/g, 255-value);


  },

  getFullColor: function(value) {
    var fromH = 62;
    var toH = 0;
    var percent = value / 255;
    var delta = percent * (toH - fromH);
    var hue = fromH + delta;
    return 'hsl(H, 100%, 50%)'.replace(/H/g, hue);
  },

  logScale_: function(index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = this.logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.pow(base, exp) - 1;
  },

  logChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },

  resolutionMaxChanged: function() {
    if(this.labels){
      this.renderAxesLabels();
    }
  },

  resolutionMinChanged: function() {
    if(this.labels){
      this.renderAxesLabels();
    }
  },

  pauseChanged: function() {
    var saveSpeed = 2;
    if(this.speed!=0) {
      saveSpeed = this.speed;
      this.speed = 0;

    } else {
      this.speed = saveSpeed;
    }

  },

  ticksChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },

  labelsChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    } else {
      this.clearAxesLabels();
    }
  }
});
