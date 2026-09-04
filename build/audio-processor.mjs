class audioProcessor extends AudioWorkletProcessor {
	constructor(...args) {
		super(...args);
		this.audioSample = 0;
		this.byteSample = 0;
		this.divisorStorage = 0;
		this.drawMode = 'Points';
		this.errorDisplayed = true;
		this.func = null;
		this.getValues = null;
		this.isFuncbeat = false;
		this.isPlaying = false;
		this.lastByteValue = [null, null, null];
		this.lastFuncValue = [null, null, null];
		this.lastOutputChannels = 1;
		this.lastTime = -1;
		this.outValue = [0, 0];
		this.outValueChannels = [0, 0, 0];
		this.fftRawOutput = false;
		this.playbackSpeed = 1;
		this.sampleRate = 8000;
		this.sampleRatio = 1;
		this.srDivisor = 1;
		this.fftBuffer = [];
		this.fftSize = 256;
		this.audioFiles = new Map();
		Object.seal(this);
		audioProcessor.deleteGlobals();
		audioProcessor.freezeGlobals();
		this.port.addEventListener('message', e => this.receiveData(e.data));
		this.port.start();
	}
	static deleteGlobals() {
		// Delete single letter variables to prevent persistent variable errors (covers a good enough range)
		for(let i = 0; i < 26; ++i) {
			delete globalThis[String.fromCharCode(65 + i)];
			delete globalThis[String.fromCharCode(97 + i)];
		}
		// Delete global variables
		for(const name in globalThis) {
			if(Object.prototype.hasOwnProperty.call(globalThis, name)) {
				delete globalThis[name];
			}
		}
	}
	static freezeGlobals() {
		Object.getOwnPropertyNames(globalThis).forEach(name => {
			const prop = globalThis[name];
			const type = typeof prop;
			if((type === 'object' || type === 'function') && name !== 'globalThis') {
				Object.freeze(prop);
			}
			if(type === 'function' && Object.prototype.hasOwnProperty.call(prop, 'prototype')) {
				Object.freeze(prop.prototype);
			}
			Object.defineProperty(globalThis, name, { writable: false, configurable: false });
		});
	}
	static getErrorMessage(err, time) {
		const when = time === null ? 'compilation' : 't=' + time;
		if(!(err instanceof Error)) {
			return `${ when } thrown: ${ typeof err === 'string' ? err : JSON.stringify(err) }`;
		}
		const { message, lineNumber, columnNumber } = err;
		return `${ when } error: ${ typeof message === 'string' ? message : JSON.stringify(message) }${
			typeof lineNumber === 'number' && typeof columnNumber === 'number' ?
				` (at line ${ lineNumber - 3 }, character ${ +columnNumber })` : '' }`;
	}
	process(inputs, [chData]) {
		const chDataLen = chData[0].length;
		if(!chDataLen || !this.isPlaying) {
			return true;
		}
		let time = this.sampleRatio * this.audioSample;
		let { byteSample } = this;
		const divisor = Math.max(1, this.srDivisor || 1);
		const drawBuffer = [];
		const isDiagram = this.drawMode === 'Combined' || this.drawMode === 'Diagram';
		for(let i = 0; i < chDataLen; ++i) {
			time += this.sampleRatio;
			// make sure you dont modify this because it will mess up the scope
			const currentTime = Math.floor(time);
			if(this.lastTime !== currentTime) {
				let funcValue;
				const currentSample = Math.floor(byteSample);
				const divisorMet = (((currentTime % divisor) + divisor) % divisor) === 0;
				try {
					if(this.isFuncbeat) {
						funcValue = this.func(currentSample / this.sampleRate, this.sampleRate);
					} else {
						funcValue = this.func(currentSample);
					}
					if(!divisorMet) {
						funcValue = this.divisorStorage;
					} else {
						this.divisorStorage = funcValue;
					}
				} catch(err) {
					if(this.errorDisplayed) {
						this.errorDisplayed = false;
						this.sendData({
							error: {
								message: audioProcessor.getErrorMessage(err, currentSample),
								isRuntime: true
							}
						});
					}
					funcValue = NaN;
				}
				const outputChannels = Array.isArray(funcValue) ? Math.max(0, Math.min(funcValue.length, 3)) : 1;
				let values = Array.isArray(funcValue) ? funcValue.slice() : [funcValue];
				let hasCenter = false;
				if(Array.isArray(funcValue)) {
					if(funcValue.length >= 3) {
						values = [funcValue[0], funcValue[1], funcValue[2]];
						hasCenter = true;
					} else if(funcValue.length === 2) {
						values = [funcValue[0], NaN, funcValue[1]];
					} else if(funcValue.length === 1) {
						values = [funcValue[0], NaN, funcValue[0]];
					} else {
						values = [NaN, NaN, NaN];
					}
				} else {
					values = [funcValue, NaN, funcValue];
				}
				if(!hasCenter) {
					this.lastFuncValue[1] = NaN;
					this.lastByteValue[1] = NaN;
					this.outValueChannels[1] = 0;
				}
				let hasValue = false;
				const channelIndices = hasCenter ? [0, 1, 2] : [0, 2];
				for(const ch of channelIndices) {
					try {
						values[ch] = +values[ch];
					} catch(err) {
						values[ch] = NaN;
					}
					if(isDiagram) {
						if(!isNaN(values[ch])) {
							this.outValueChannels[ch] = this.getValues(values[ch], ch);
						} else {
							this.lastByteValue[ch] = NaN;
						}
						hasValue = true;
						continue;
					}
					if(values[ch] === this.lastFuncValue[ch]) {
						continue;
					} else if(!isNaN(values[ch])) {
						this.outValueChannels[ch] = this.getValues(values[ch], ch);
						hasValue = true;
					} else if(!isNaN(this.lastFuncValue[ch])) {
						this.lastByteValue[ch] = NaN;
						hasValue = true;
					}
				}
				if(hasCenter) {
					const left = this.outValueChannels[0];
					const center = this.outValueChannels[1];
					const right = this.outValueChannels[2];
					this.outValue[0] = left * (2 / 3) + center / 3;
					this.outValue[1] = right * (2 / 3) + center / 3;
				} else {
					this.outValue[0] = this.outValueChannels[0];
					this.outValue[1] = this.outValueChannels[2];
				}
				if(outputChannels !== this.lastOutputChannels) {
					hasValue = true;
				}
				if(hasValue) {
					drawBuffer.push({ t: byteSample, value: [...this.lastByteValue], channels: outputChannels });
				}

				byteSample += currentTime - this.lastTime;
				this.lastFuncValue = values;
				this.lastOutputChannels = outputChannels;
				this.lastTime = currentTime;
			}
			if(this.fftRawOutput && chData[2]) {
				chData[0][i] = this.outValueChannels[0];
				chData[1][i] = this.outValueChannels[1];
				chData[2][i] = this.outValueChannels[2];
			} else {
				chData[0][i] = this.outValue[0];
				chData[1][i] = this.outValue[1];
				if(chData[2]) {
					chData[2][i] = this.outValueChannels[1];
				}
			}
		}
		if(Math.abs(byteSample) > Number.MAX_SAFE_INTEGER) {
			this.resetTime();
			return true;
		}
		this.audioSample += chDataLen;
		let isSend = false;
		const data = {};
		if(byteSample !== this.byteSample) {
			isSend = true;
			data.byteSample = this.byteSample = byteSample;
		}
		if(drawBuffer.length) {
			isSend = true;
			data.drawBuffer = drawBuffer;
			// Collect samples for FFT
			for(const sample of drawBuffer) {
				const left = sample.value[0];
				const center = sample.value[1];
				const right = sample.value[2];
				const mix = !isNaN(right) ? (left + right) / 2 :
					!isNaN(center) ? (left + center) / 2 : left;
				this.fftBuffer.push(mix);
			}
			if(this.fftBuffer.length >= this.fftSize) {
				data.fftData = this.fftBuffer.slice(-this.fftSize);
				this.fftBuffer = this.fftBuffer.slice(-this.fftSize);
			}
		}
		if(isSend) {
			this.sendData(data);
		}
		return true;
	}
	receiveData(data) {
		if(data.byteSample !== undefined) {
			this.byteSample = +data.byteSample || 0;
			this.resetValues();
		}
		if(data.errorDisplayed === true) {
			this.errorDisplayed = true;
		}
		if(data.isPlaying !== undefined) {
			this.isPlaying = data.isPlaying;
		}

		if(data.srDivisor !== undefined) {
			this.srDivisor = data.srDivisor;
		}
		if(data.playbackSpeed !== undefined) {
			const sampleRatio = this.sampleRatio / this.playbackSpeed;
			this.playbackSpeed = data.playbackSpeed;
			this.setSampleRatio(sampleRatio);
		}
		if(data.mode !== undefined) {
			this.isFuncbeat = data.mode === 'Funcbeat';
			if (this.isFuncbeat) {
			    this.getValues = (funcValue, ch) => {
			        const outValue = Math.max(Math.min(funcValue, 1), -1);
			        this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
			        return outValue;
			    };
			} else {
			    this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = NaN);
			}
			if (this.isFuncbeat) {
			    this.getValues = (funcValue, ch) => {
			        const outValue = Math.max(Math.min(funcValue, 1), -1);
			        this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
			        return outValue;
			    };
			} else {
			    this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = NaN);
			}
			switch(data.mode) {
			case 'Bytebeat':
				this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = funcValue & 255) / 127.5 - 1;
				break;
			case 'postfix':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = funcValue & 255) / 127.5 - 1;
					break;
			case 'Signed Bytebeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = (funcValue + 128) & 255) / 127.5 - 1;
				break;
			case 'Bitbeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = funcValue & 1 ? 192 : 64) / 127.5 - 1;
				break;
			case '2048':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = Math.floor(funcValue / 8) & 255) / 127.5 - 1;
				break;
			case 'logmode':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = (Math.log2(funcValue) * 32) & 255) / 127.5 - 1;
				break;
			case 'tanhbeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = Math.tanh(funcValue);
				break;
			case 'sinefloatbeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = Math.sin(Math.min(Math.max(funcValue,-1),1)*Math.PI/2);
				break;
			case 'logHack':
				this.getValues = (funcValue, ch) => {
					const neg = (funcValue < 0) ? -32 : 32;
					this.lastByteValue[ch] = (Math.log2(Math.abs(funcValue)) * neg) & 255;
					return this.lastByteValue[ch] / 127.5 - 1;
				};
				break;
			case 'logHack2':
				this.getValues = (funcValue, ch) => {
					const neg = funcValue < 0;
					if(funcValue === 0) {
						this.lastByteValue[ch] = 128;
						return 0;
					}
					this.lastByteValue[ch] =
						((Math.log2(Math.abs(funcValue)) * (neg ? -16 : 16)) + (neg ? -127 : 128)) & 255;
					return this.lastByteValue[ch] / 127.5 - 1;
				};
				break;
			case 'Floatbeat':
			case 'Funcbeat':
				this.getValues = (funcValue, ch) => {
					const outValue = Math.max(Math.min(funcValue, 1), -1);
					this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
					return outValue;
				};
				break;
			case 'Tanmode':
					this.getValues = (funcValue, ch) => {
						const outValue = Math.max(Math.min(Math.tan(funcValue * Math.PI / 128), 1), -1);
						this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
						return outValue;
					};
					break;
			case 'Sinmode':
					this.getValues = (funcValue, ch) => {
						const outValue = Math.max(Math.min(Math.sin(funcValue * Math.PI / 128), 1), -1);
						this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
						return outValue;
					};
					break;
			case 'Inverted Bytebeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = (funcValue + 1) * - 1 & 255) / 127.5 - 1;
				
			 break;
			default: this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = NaN);
			}
		}
		if(data.drawMode !== undefined) {
			this.drawMode = data.drawMode;
		}
		if(data.setFunction !== undefined) {
			this.setFunction(data.setFunction);
		}
		if(data.resetTime === true) {
			this.resetTime();
		}
		if(data.sampleRate !== undefined) {
			this.sampleRate = data.sampleRate;
		}
		if(data.sampleRatio !== undefined) {
			this.setSampleRatio(data.sampleRatio);
		}
		if(data.audioFiles !== undefined) {
			this.audioFiles = new Map(data.audioFiles);
		}
		if(data.fftRawOutput !== undefined) {
			this.fftRawOutput = !!data.fftRawOutput;
		}
	}
	sendData(data) {
		this.port.postMessage(data);
	}
	resetTime() {
		this.byteSample = 0;
		this.resetValues();
		this.sendData({ byteSample: 0 });
	}
	resetValues() {
		this.audioSample = 0;
		this.divisorStorage = 0;
		this.lastByteValue = [null, null, null];
		this.lastFuncValue = [null, null, null];
		this.lastTime = -1;
		this.outValue = [0, 0];
		this.outValueChannels = [0, 0, 0];
	}
	setFunction(codeText) {
		// Create shortened Math functions
		const params = Object.getOwnPropertyNames(Math);
		const values = params.map(k => Math[k]);
		
		const funcs = {
			/*bit*/        "bitC": function (x, y, z) { return x & y ? z : 0 },
			/*bit reverse*/"br": function (x, size = 8) {
				if (size > 32) { throw new Error("br() Size cannot be greater than 32") } else {
					let result = 0;
					for (let idx = 0; idx < (size - 0); idx++) {
						result += funcs.bitC(x, 2 ** idx, 2 ** (size - (idx + 1)))
					}
					return result
				}
			},
			/*sin that loops every 128 "steps", instead of every pi steps*/"sinf": function (x) { return Math.sin(x / (128 / Math.PI)) },
			/*cos that loops every 128 "steps", instead of every pi steps*/"cosf": function (x) { return Math.cos(x / (128 / Math.PI)) },
			/*tan that loops every 128 "steps", instead of every pi steps*/"tanf": function (x) { return Math.tan(x / (128 / Math.PI)) },
			/*converts t into a string composed of it's bits, regex's that*/"regG": function (t, X) { return X.test(t.toString(2)) },

			"saw": t => t % 256,
			"tri": t => Math.abs((t % 512) - 256),
			"sq": t => t % 256 < 128 ? 255 : 0,
			"audioIN": (index, channel = 0, file = 0) => {
				const audioFile = this.audioFiles.get(file);
				if (!audioFile || !audioFile.data) return 0;
				const sampleIndex = Math.floor(index) * audioFile.channels + (channel % audioFile.channels);
				return audioFile.data[sampleIndex] || 0;
			},
			"audioLength": (file = 0) => {
				const audioFile = this.audioFiles.get(file);
				return audioFile ? audioFile.data.length/audioFile.channels : 0;
			}, 
				"linear": (x) => x, 

            "sine": (x, dir) => { switch (dir) { case "in": { return 1 - Math.cos((x * Math.PI) / 2); } case "out": { return Math.sin((x * Math.PI) / 2); } case "in out": { return -(Math.cos(Math.PI * x) - 1) / 2; } default: return 0; } }, 

            "quad": (x, dir) => { switch (dir) { case "in": { return x * x; } case "out": { return 1 - (1 - x) * (1 - x); } case "in out": { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; } default: return 0; } }, 

            "cubic": (x, dir) => { switch (dir) { case "in": { return x * x * x; } case "out": { return 1 - Math.pow(1 - x, 3); } case "in out": { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; } default: return 0; } }, 

            "quart": (x, dir) => { switch (dir) { case "in": { return x * x * x * x; } case "out": { return 1 - Math.pow(1 - x, 4); } case "in out": { return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; } default: return 0; } }, 

            "quint": (x, dir) => { switch (dir) { case "in": { return x * x * x * x * x; } case "out": { return 1 - Math.pow(1 - x, 5); } case "in out": { return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; } default: return 0; } }, 

             "expo": (x, dir) => { switch (dir) { case "in": { return x === 0 ? 0 : Math.pow(2, 10 * x - 10); } case "out": { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } case "in out": { return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; } default: return 0; } }, 

             "circ": (x, dir) => { switch (dir) { case "in": { return 1 - Math.sqrt(1 - Math.pow(x, 2)); } case "out": { return Math.sqrt(1 - Math.pow(x - 1, 2)); } case "in out": { return x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2; } default: return 0; } }, 

             "back": (x, dir) => { switch (dir) { case "in": { const c1 = 1.70158; const c3 = c1 + 1; return c3 * x * x * x - c1 * x * x; } case "out": { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); } case "in out": { const c1 = 1.70158; const c2 = c1 * 1.525; return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2; } default: return 0; } }, 
             "elastic": (x, dir) => { switch (dir) { case "in": { const c4 = (2 * Math.PI) / 3; return x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4); } case "out": { const c4 = (2 * Math.PI) / 3; return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1; } case "in out": { const c5 = (2 * Math.PI) / 4.5; return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1; } default: return 0; } }, 
             "bounce": (x, dir) => { switch (dir) { case "in": { return 1 - bounce(1 - x, "out"); } case "out": { const n1 = 7.5625; const d1 = 2.75; if (x < 1 / d1) { return n1 * x * x; } else if (x < 2 / d1) { return n1 * (x -= 1.5 / d1) * x + 0.75; } else if (x < 2.5 / d1) { return n1 * (x -= 2.25 / d1) * x + 0.9375; } else { return n1 * (x -= 2.625 / d1) * x + 0.984375; } } case "in out": { return x < 0.5 ? (1 - bounce(1 - 2 * x, "out")) / 2 : (1 + bounce(2 * x - 1, "out")) / 2; } default: return 0; } }
		};
		
		params.push('int', 'window', ...Object.keys(funcs));
		values.push(Math.floor, globalThis, ...Object.values(funcs));
		audioProcessor.deleteGlobals();
		// Code testing
		let isCompiled = false;
		const oldFunc = this.func;
		try {
			if(this.isFuncbeat) {
				this.func = new Function(...params, codeText).bind(globalThis, ...values);
			} else {
				// Optimize code like eval(unescape(escape`XXXX`.replace(/u(..)/g,"$1%")))
				codeText = codeText.trim().replace(
					/^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.\.\)\/g,["'`]\$1%["'`]\)\)\)$/,
					(match, m1) => unescape(escape(m1).replace(/u(..)/g, '$1%')));
				this.func = new Function(...params, 't', `return 0,\n${ codeText || 0 };`)
					.bind(globalThis, ...values);
			}
			isCompiled = true;
			if(this.isFuncbeat) {
				this.func = this.func();
				this.func(0, this.sampleRate);
			} else {
				this.func(0);
			}
		} catch(err) {
			if(!isCompiled) {
				this.func = oldFunc;
			}
			this.errorDisplayed = false;
			this.sendData({
				error: { message: audioProcessor.getErrorMessage(err, isCompiled ? 0 : null), isCompiled },
				updateUrl: isCompiled
			});
			return;
		}
		this.errorDisplayed = false;
		this.sendData({ error: { message: '', isCompiled }, updateUrl: true });
	}
	setSampleRatio(sampleRatio) {
		const timeOffset = Math.floor(this.sampleRatio * this.audioSample) - this.lastTime;
		this.sampleRatio = sampleRatio * this.playbackSpeed;
		this.lastTime = Math.floor(this.sampleRatio * this.audioSample) - timeOffset;
	}
}

registerProcessor('audioProcessor', audioProcessor);
