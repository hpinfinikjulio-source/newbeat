function mod(a, b) {
	return ((a % b) + b) % b;
}

export class Scope {
	constructor() {
		this.canvasContainer = null;
		this.canvasCtx = null;
		this.canvasElem = null;
		this.canvasHeight = 256;
		this.canvasPlayButton = null;
		this.canvasTimeCursor = null;
		this.canvasWidth = 1024;
		this.colorDiagramLeft = null;
		this.colorDiagramCenter = null;
		this.colorDiagramMono = null;
		this.colorDiagramRight = null;
		this.colorWaveformLeft = null;
		this.colorWaveformCenter = null;
		this.colorWaveformMono = null;
		this.colorWaveformRight = null;
		this.drawBuffer = [];
		this.drawEndBuffer = [];
		this.drawMode = 'Combined';
		this.drawScale = 5;
		this.analyser = null;
		this.analyserData = null;
		this.analyserLeft = null;
		this.analyserCenter = null;
		this.analyserRight = null;
		this.analyserLeftData = null;
		this.analyserCenterData = null;
		this.analyserRightData = null;
		this.showExtraFftChannels = false;
		this.showMonoFft = true;
		this.showFftFill = false;
		this.fftBlendMode = 'source-over';
		this.fftBinSize = 1024;
	}
	get timeCursorEnabled() {
		return globalThis.bytebeat.sampleRate >> this.drawScale < 2000;
	}
	clearCanvas() {
		this.canvasCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
	}
	drawGraphics(endTime) {
		if(!isFinite(endTime)) {
			globalThis.bytebeat.resetTime();
			return;
		}
		const buffer = this.drawBuffer;
		const bufferLen = buffer.length;
		if(!bufferLen) {
			return;
		}
		const width = this.canvasWidth;
		const height = this.canvasHeight;
		const scale = this.drawScale;
		const isReverse = globalThis.bytebeat.playbackSpeed < 0;
		let startTime = buffer[0].t;
		let startX = mod(this.getX(startTime), width);
		let endX = Math.floor(startX + this.getX(endTime - startTime));
		startX = Math.floor(startX);
		let drawWidth = Math.abs(endX - startX) + 1;
		// Truncate large segments (for high playback speed or 512px canvas)
		if(drawWidth > width) {
			startTime = (this.getX(endTime) - width) * (1 << scale);
			startX = mod(this.getX(startTime), width);
			endX = Math.floor(startX + this.getX(endTime - startTime));
			startX = Math.floor(startX);
			drawWidth = Math.abs(endX - startX) + 1;
		}
		startX = Math.min(startX, endX);
		// Restoring the last points of a previous segment
		const imageData = this.canvasCtx.createImageData(drawWidth, height);
		const { data } = imageData;
		if(scale) {
			const x = isReverse ? drawWidth - 1 : 0;
			for(let y = 0; y < height; ++y) {
				const drawEndBuffer = this.drawEndBuffer[y];
				if(drawEndBuffer) {
					let idx = (drawWidth * (255 - y) + x) << 2;
					data[idx++] = drawEndBuffer[0];
					data[idx++] = drawEndBuffer[1];
					data[idx] = drawEndBuffer[2];
				}
			}
		}
		// Filling an alpha channel in a segment
		for(let x = 0; x < drawWidth; ++x) {
			for(let y = 0; y < height; ++y) {
				data[((drawWidth * y + x) << 2) + 3] = 255;
			}
		}
		// FFT visualization
		if(this.drawMode === 'FFT' && this.analyser && this.analyserData) {
			const resolveBlendMode = mode => (mode === 'subtract' ? 'difference' : (mode || 'source-over'));
			const drawFftLine = (data, color, alpha = 1, fillBlendMode = 'source-over', lineBlendMode = 'source-over') => {
				this.canvasCtx.beginPath();
				this.canvasCtx.strokeStyle = `rgb(${ color[0] },${ color[1] },${ color[2] })`;
				this.canvasCtx.globalAlpha = alpha;
				this.canvasCtx.lineWidth = 1;
				const binCount = data.length;
				const logMin = 1;
				const logMax = Math.log(binCount + 1);
				for(let i = 0; i < binCount; i++) {
					const value = data[i];
					const y = height - (value / 255) * height;
					const x = (Math.log(i + logMin) / logMax) * width;
					if(i === 0) {
						this.canvasCtx.moveTo(x, y);
					} else {
						this.canvasCtx.lineTo(x, y);
					}
				}
				if(this.showFftFill) {
					this.canvasCtx.globalCompositeOperation = resolveBlendMode(fillBlendMode);
					this.canvasCtx.lineTo(width, height);
					this.canvasCtx.lineTo(0, height);
					this.canvasCtx.closePath();
					this.canvasCtx.fillStyle = `rgb(${ color[0] },${ color[1] },${ color[2] })`;
					this.canvasCtx.fill();
				} else {
					this.canvasCtx.globalCompositeOperation = resolveBlendMode(lineBlendMode);
					this.canvasCtx.stroke();
				}
				this.canvasCtx.globalAlpha = 1;
			};
			this.analyser.getByteFrequencyData(this.analyserData);
			if(this.analyserLeft && this.analyserLeftData) {
				this.analyserLeft.getByteFrequencyData(this.analyserLeftData);
			}
			if(this.analyserCenter && this.analyserCenterData) {
				this.analyserCenter.getByteFrequencyData(this.analyserCenterData);
			}
			if(this.analyserRight && this.analyserRightData) {
				this.analyserRight.getByteFrequencyData(this.analyserRightData);
			}
			this.clearCanvas();
			const monoColor = this.colorWaveformMono || this.colorWaveformCenter || this.colorWaveformLeft;
			if(this.showExtraFftChannels && this.analyserLeftData && this.analyserRightData && this.analyserCenterData) {
				const leftColor = this.colorWaveformLeft || monoColor;
				const centerColor = this.colorWaveformCenter || monoColor;
				const rightColor = this.colorWaveformRight || monoColor;
				drawFftLine(this.analyserLeftData, leftColor, 1, 'lighter', 'lighter');
				drawFftLine(this.analyserCenterData, centerColor, 1, 'lighter', 'lighter');
				drawFftLine(this.analyserRightData, rightColor, 1, 'lighter', 'lighter');
			}
			if(this.showMonoFft) {
				drawFftLine(this.analyserData, monoColor, 1, this.fftBlendMode, 'source-over');
			}
			this.canvasCtx.globalCompositeOperation = 'source-over';
			this.canvasCtx.globalCompositeOperation = 'source-over';
			this.drawBuffer = [{ t: endTime, value: buffer[bufferLen - 1].value }];
			return;
		}
		// Drawing in a segment
		const isCombined = this.drawMode === 'Combined';
		const isDiagram = this.drawMode === 'Diagram';
		const isWaveform = this.drawMode === 'Waveform';
		const colorDiagram = [
			this.colorDiagramLeft,
			this.colorDiagramCenter,
			this.colorDiagramRight
		];
		const colorPoints = [
			this.colorWaveformLeft,
			this.colorWaveformCenter,
			this.colorWaveformRight
		];
		const colorWaveform = colorPoints.map(color =>
			!isWaveform ? color : [
				Math.floor(.6 * color[0] | 0),
				Math.floor(.6 * color[1] | 0),
				Math.floor(.6 * color[2] | 0)
			]
		);
		const drawDiagramPoint = this.drawBlendPoint;
		const drawPoint = this.drawBlendPoint;
		const drawWavePoint = this.drawBlendPoint;
		for(let i = 0; i < bufferLen; ++i) {
			const sample = buffer[i];
			const curY = sample.value;
			const outputChannels = Number.isFinite(sample.channels) ? sample.channels : 1;
			const prevY = buffer[i - 1]?.value ?? [NaN, NaN, NaN];
			const isNaNCurY = [isNaN(curY[0]), isNaN(curY[1]), isNaN(curY[2])];
			const isCenterOnlyNaN = isNaNCurY[1] && !isNaNCurY[0] && !isNaNCurY[2];
			const isMonoLR = outputChannels <= 1 && !isNaNCurY[0] && !isNaNCurY[2];
			const curTime = buffer[i].t;
			const nextTime = buffer[i + 1]?.t ?? endTime;
			const curX = mod(Math.floor(this.getX(isReverse ? nextTime + 1 : curTime)) - startX, width);
			const nextX = mod(Math.ceil(this.getX(isReverse ? curTime + 1 : nextTime)) - startX, width);
			let diagramSize, diagramStart;
			if(isCombined || isDiagram) {
				diagramSize = Math.max(1, 256 >> scale);
				diagramStart = diagramSize * mod(curTime, 1 << scale);
			} else if(!isCenterOnlyNaN && (isNaNCurY[0] || isNaNCurY[1] || isNaNCurY[2])) {
				// Error value - filling with red color
				for(let x = curX; x !== nextX; x = mod(x + 1, width)) {
					for(let y = 0; y < height; ++y) {
						const idx = (drawWidth * y + x) << 2;
						if(!data[idx + 1] && !data[idx + 2]) {
							data[idx] = 100; // Error: red color
						}
					}
				}
			}
			if(isMonoLR && (isCombined || isDiagram || isWaveform)) {
				const curYCh = curY[0];
				const monoPoint = this.colorWaveformMono;
				const monoWave = !isWaveform ? monoPoint : [
					Math.floor(.6 * monoPoint[0] | 0),
					Math.floor(.6 * monoPoint[1] | 0),
					Math.floor(.6 * monoPoint[2] | 0)
				];
				if(isCombined || isDiagram) {
					const value = (curYCh & 255) / 256;
					const monoDiagram = this.colorDiagramMono;
					const color = [
						value * monoDiagram[0] | 0,
						value * monoDiagram[1] | 0,
						value * monoDiagram[2] | 0
					];
					for(let x = curX; x !== nextX; x = mod(x + 1, width)) {
						for(let y = 0; y < diagramSize; ++y) {
							const idx = (drawWidth * (diagramStart + y) + x) << 2;
							drawDiagramPoint(data, idx, color);
						}
					}
				}
				if(!isDiagram) {
					for(let x = curX; x !== nextX; x = mod(x + 1, width)) {
						drawPoint(data, (drawWidth * (255 - curYCh) + x) << 2, monoPoint);
					}
					if(isCombined || isWaveform) {
						const prevYCh = prevY[0];
						if(!isNaN(prevYCh)) {
							const x = isReverse ? mod(Math.floor(this.getX(curTime)) - startX, width) : curX;
							for(let dy = prevYCh < curYCh ? 1 : -1, y = prevYCh; y !== curYCh; y += dy) {
								drawWavePoint(data, (drawWidth * (255 - y) + x) << 2, monoWave);
							}
						}
					}
				}
				continue;
			}
			for(let ch = 0; ch < 3; ch++) {
				const curYCh = curY[ch];
				const colorCh = colorPoints[ch];
				const diagramColorCh = colorDiagram[ch];
				const waveformColorCh = colorWaveform[ch];
				// Diagram drawing
				if(isCombined || isDiagram) {
					const isNaNCurYCh = isNaNCurY[ch];
					const value = (curYCh & 255) / 256;
					const color = [
						value * diagramColorCh[0] | 0,
						value * diagramColorCh[1] | 0,
						value * diagramColorCh[2] | 0
					];
					for(let x = curX; x !== nextX; x = mod(x + 1, width)) {
						for(let y = 0; y < diagramSize; ++y) {
							const idx = (drawWidth * (diagramStart + y) + x) << 2;
							if(isNaNCurYCh) {
								if(!(isCenterOnlyNaN && ch === 1)) {
									data[idx] = 100; // Error: red color
								}
							} else {
								drawDiagramPoint(data, idx, color);
							}
						}
					}
				}
				if(isNaNCurY[ch] || isDiagram) {
					continue;
				}
				// Points drawing
				for(let x = curX; x !== nextX; x = mod(x + 1, width)) {
					drawPoint(data, (drawWidth * (255 - curYCh) + x) << 2, colorCh);
				}
				// Waveform vertical lines drawing
				if(isCombined || isWaveform) {
					const prevYCh = prevY[ch];
					if(isNaN(prevYCh)) {
						continue;
					}
					const x = isReverse ? mod(Math.floor(this.getX(curTime)) - startX, width) : curX;
					for(let dy = prevYCh < curYCh ? 1 : -1, y = prevYCh; y !== curYCh; y += dy) {
						drawWavePoint(data, (drawWidth * (255 - y) + x) << 2, waveformColorCh);
					}
				}
			}
		}
		// Saving the last points of a segment
		if(scale) {
			const x = isReverse ? 0 : drawWidth - 1;
			for(let y = 0; y < height; ++y) {
				let idx = (drawWidth * (255 - y) + x) << 2;
				this.drawEndBuffer[y] = [data[idx++], data[idx++], data[idx]];
			}
		}
		// Placing a segment on the canvas
		this.canvasCtx.putImageData(imageData, startX, 0);
		if(endX >= width) {
			this.canvasCtx.putImageData(imageData, startX - width, 0);
		} else if(endX <= 0) {
			this.canvasCtx.putImageData(imageData, startX + width, 0);
		}
		// Move the cursor to the end of the segment
		if(this.timeCursorEnabled) {
			this.canvasTimeCursor.style.left = endX / width * 100 + '%';
		}

		// Clear buffer
		this.drawBuffer = [{ t: endTime, value: buffer[bufferLen - 1].value }];
	}
	drawPoint(data, i, color) {
		data[i++] = color[0];
		data[i++] = color[1];
		data[i] = color[2];
	}
	drawSoftPoint(data, i, color) {
		if(data[i] || data[i + 1] || data[i + 2]) {
			return;
		}
		data[i++] = color[0];
		data[i++] = color[1];
		data[i] = color[2];
	}
	drawBlendPoint(data, i, color) {
		data[i] = Math.min(255, data[i] + color[0]);
		data[i + 1] = Math.min(255, data[i + 1] + color[1]);
		data[i + 2] = Math.min(255, data[i + 2] + color[2]);
	}
	getX(t) {
		return t / (1 << this.drawScale);
	}
	initElements() {
		this.canvasContainer = document.getElementById('canvas-container');
		this.canvasElem = document.getElementById('canvas-main');
		this.canvasCtx = this.canvasElem.getContext('2d');
		this.canvasPlayButton = document.getElementById('canvas-play');
		this.canvasTimeCursor = document.getElementById('canvas-timecursor');
		this.onresizeWindow();
		document.defaultView.addEventListener('resize', () => this.onresizeWindow());
	}
	onresizeWindow() {
		const isSmallWindow = window.innerWidth <= 768 || window.innerHeight <= 768;
		if(this.canvasWidth === 1024) {
			if(isSmallWindow) {
				this.canvasWidth = this.canvasElem.width = 512;
			}
		} else if(!isSmallWindow) {
			this.canvasWidth = this.canvasElem.width = 1024;
		}
	}
	requestAnimationFrame() {
		window.requestAnimationFrame(() => {
			this.drawGraphics(globalThis.bytebeat.byteSample);
			if(globalThis.bytebeat.isPlaying) {
				this.requestAnimationFrame();
			}
		});
	}
	toggleTimeCursor() {
		this.canvasTimeCursor.classList.toggle('hidden', !this.timeCursorEnabled);
	}

}
