/**
 * Lightweight Real-time Canvas Time-Series Chart (< 3KB, zero external dependencies)
 */

export class TimeSeriesChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = options.maxPoints || 30;
    this.dataPoints = [];
    this.lineColor = options.lineColor || '#0070f3'; // Vercel Electric Blue
    this.fillColor = options.fillColor || 'rgba(0, 112, 243, 0.12)';
    this.unit = options.unit || 'W';

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 220) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height || 220;
    this.render();
  }

  addDataPoint(val, label = '') {
    if (!this.canvas) return;
    this.dataPoints.push({
      val: Number(val) || 0,
      label: label || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    if (this.dataPoints.length > this.maxPoints) {
      this.dataPoints.shift();
    }
    this.render();
  }

  render() {
    if (!this.ctx || this.dataPoints.length === 0) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const paddingBottom = 25;
    const paddingTop = 15;
    const chartHeight = h - paddingBottom - paddingTop;

    ctx.clearRect(0, 0, w, h);

    // Calculate dynamic range
    const values = this.dataPoints.map(d => d.val);
    let maxVal = Math.max(...values, 100);
    let minVal = Math.min(...values, 0);
    maxVal = Math.ceil(maxVal * 1.15); // Add headroom

    // Draw grid lines
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = paddingTop + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const labelVal = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.fillStyle = '#737373';
      ctx.font = '11px "Geist Mono", monospace';
      ctx.fillText(`${labelVal} ${this.unit}`, 5, y - 4);
    }

    if (this.dataPoints.length < 2) return;

    // Draw Smooth Line & Gradient Fill
    const stepX = w / (this.maxPoints - 1);
    const getX = (idx) => idx * stepX;
    const getY = (val) => paddingTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(this.dataPoints[0].val));

    for (let i = 1; i < this.dataPoints.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(this.dataPoints[i - 1].val);
      const curX = getX(i);
      const curY = getY(this.dataPoints[i].val);
      const cpX = (prevX + curX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, curY, curX, curY);
    }

    // Line Stroke
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Area Fill
    ctx.lineTo(getX(this.dataPoints.length - 1), h - paddingBottom);
    ctx.lineTo(getX(0), h - paddingBottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
    grad.addColorStop(0, this.fillColor);
    grad.addColorStop(1, 'rgba(0, 112, 243, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Timestamp labels at bottom
    ctx.fillStyle = '#737373';
    ctx.font = '11px "Geist Mono", monospace';
    const firstLabel = this.dataPoints[0].label;
    const lastLabel = this.dataPoints[this.dataPoints.length - 1].label;
    ctx.fillText(firstLabel, 5, h - 8);
    ctx.fillText(lastLabel, w - 55, h - 8);
  }
}
