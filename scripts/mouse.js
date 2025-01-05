const canvas = document.getElementById("main-canvas");

export class CanvasMouseInputHandler {
    constructor() {
        this.mouseX = 0; //uses client x and y
        this.mouseY = 0; // in NDC (Normalized device coordinates)
        this.down = false;

        this.resX = canvas.clientWidth;
        this.resY = canvas.clientHeight;

        this.centerX = this.resX / 2;
        this.centerY = this.resY / 2;

        canvas.addEventListener("mousemove", (e) => {
            if (!e.isTrusted) {
                return;
            }

            this.mouseX = (e.clientX - this.centerX) / this.resX;
            this.mouseY = (e.clientY - this.centerY) / this.resY;
        });

        canvas.addEventListener("mousedown", (e) => {
            this.down = true;
        });

        canvas.addEventListener("mouseup", (e) => {
            this.down = false;
        });
    }

    updateCanvasParams() {
        this.resX = canvas.clientWidth;
        this.resY = canvas.clientHeight;

        this.centerX = this.resX / 2;
        this.centerY = this.resY / 2;
    }
}