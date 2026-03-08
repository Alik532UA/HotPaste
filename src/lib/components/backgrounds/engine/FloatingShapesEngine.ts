import { CanvasEngine } from "./CanvasEngine";

interface FloatingShape {
    x: number;
    y: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    vx: number;
    vy: number;
    type: "triangle" | "square" | "hexagon" | "circle";
    alpha: number;
}

export class FloatingShapesEngine extends CanvasEngine {
    private shapes: FloatingShape[] = [];

    protected init() {
        this.shapes = [];
        const types: ("triangle" | "square" | "hexagon" | "circle")[] = [
            "triangle",
            "square",
            "hexagon",
            "circle",
        ];
        const count = 12;
        for (let i = 0; i < count; i++) {
            this.shapes.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: 20 + Math.random() * 40,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.01,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                type: types[Math.floor(Math.random() * types.length)],
                alpha: 0.05 + Math.random() * 0.08,
            });
        }
    }

    protected draw() {
        if (!this.ctx) return;
        const colors = this.getColors();
        const time = Date.now() * 0.001;
        const scrollRotation = this.scrollY * 0.001;

        this.ctx.clearRect(0, 0, this.width, this.height);

        this.shapes.forEach((shape) => {
            shape.x += shape.vx;
            shape.y += shape.vy;
            shape.rotation += shape.rotationSpeed;

            if (shape.x < -shape.size) shape.x = this.width + shape.size;
            if (shape.x > this.width + shape.size) shape.x = -shape.size;
            if (shape.y < -shape.size) shape.y = this.height + shape.size;
            if (shape.y > this.height + shape.size) shape.y = -shape.size;

            this.ctx!.save();
            this.ctx!.translate(shape.x, shape.y);
            this.ctx!.rotate(shape.rotation + scrollRotation);

            const pulse = Math.sin(time * 0.8 + shape.rotation) * 0.3 + 0.7;
            const currentAlpha = shape.alpha * pulse;

            this.ctx!.strokeStyle = colors.primary + currentAlpha + ")";
            this.ctx!.lineWidth = 1.5;
            this.ctx!.beginPath();

            switch (shape.type) {
                case "triangle":
                    this.ctx!.moveTo(0, -shape.size);
                    this.ctx!.lineTo(shape.size * 0.866, shape.size * 0.5);
                    this.ctx!.lineTo(-shape.size * 0.866, shape.size * 0.5);
                    this.ctx!.closePath();
                    break;
                case "square":
                    this.ctx!.rect(
                        -shape.size / 2,
                        -shape.size / 2,
                        shape.size,
                        shape.size,
                    );
                    break;
                case "hexagon":
                    for (let i = 0; i < 6; i++) {
                        const angle = (i * Math.PI) / 3;
                        const x = Math.cos(angle) * shape.size;
                        const y = Math.sin(angle) * shape.size;
                        if (i === 0) this.ctx!.moveTo(x, y);
                        else this.ctx!.lineTo(x, y);
                    }
                    this.ctx!.closePath();
                    break;
                case "circle":
                    this.ctx!.arc(0, 0, shape.size, 0, Math.PI * 2);
                    break;
            }

            this.ctx!.stroke();
            this.ctx!.restore();
        });
    }
}
