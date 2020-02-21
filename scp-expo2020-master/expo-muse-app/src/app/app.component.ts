import { Component } from '@angular/core';
import { MuseClient, channelNames,TelemetryData } from 'muse-js';
import { Observable, timer, of } from 'rxjs';
import * as p5 from 'p5';
import { filter } from 'rxjs/operators';
declare var MediaRecorder: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'SCP Expo 2020!';
  private muse = new MuseClient();
  connected = false;
  leftBlinks: Observable<number>;
  rightBlinks: Observable<number>;
  p5: any;
  num: number = 2000;
  width: number = window.innerWidth;
  height: number = window.innerHeight;
  particles: Particle[] = [];
  rand = Math.floor(Math.random() * 255);
  part_rgb: number[] = [255, 40, 250, 0];
  buffer: number[][] = [[],[],[],[],[]];
  recordedChunks = [];
  mediaRecorder: any;
  stream: any;
  int:any;
  recording = false;

  constructor() { 
    this.muse.connectionStatus.subscribe(newStatus => {
      this.connected = newStatus;
    });
  }

  ngOnInit() {
    this.createCanvas();
  }


  private createCanvas() {
    this.p5 = new p5(this.sketch.bind(this));
    //console.log(this.p5);
  }
  onRecord() {
    this.recording = true;
    let canvas: any = document.querySelector('#defaultCanvas0');
    this.stream = canvas.captureStream(25); // 25 FPS
    var options = { mimeType: "video/webm" };
    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
    this.mediaRecorder.onstop = this.handleStop.bind(this);
    this.mediaRecorder.start(1000);
  }

  handleStop(event) {
    this.recording = false;
    var blob = new Blob(this.recordedChunks, {
      type: "video/webm"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.setAttribute('style', "display: none");
    a.href = url;
    a.download = "test.webm";
    a.click();
    window.URL.revokeObjectURL(url);
    
    this.recordedChunks = []
  }

  handleDataAvailable(event) {
    this.recordedChunks.push(event.data);
  }

  onStopRecord() {
    console.log(this.recordedChunks);
    this.mediaRecorder.stop();
    
    
  }

  sketch(p: any) {

    //console.log(p);
    p.setup = () => {
      p.createCanvas(this.width, this.height);
      p.noStroke();
      for (let i = 0; i < this.num; i++) {
        //x value start slightly outside the right of canvas, z value how close to viewer
        var loc = p.createVector(Math.random() * p.width * 1.2, Math.random() * p.height, 2);
        var angle = 14; //any value to initialize
        var dir = p.createVector(Math.cos(angle), Math.sin(angle));
        var speed = Math.random() + 1;
        // var speed = random(5,map(mouseX,0,width,5,20));   // faster
        this.particles[i] = new Particle(loc, dir, speed, p, this.width, this.height);
      }
    };

    p.draw = () => {
      p.fill(0, 10);
      p.noStroke();
      p.rect(0, 0, this.width, this.height);
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].run();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(p.width, p.height);
    }
    p.myCustomRedrawAccordingToNewPropsHandler = (newProps) => {
      if (p.canvas) //Make sure the canvas has been created
        p.fill(newProps.color);
    }
  }

  smooth(arr: number[], is_rgb: boolean) {
    let mean = arr.reduce((a,b) => a + b)/arr.length;
    let s = Math.sqrt(arr.map(x => Math.pow(x-mean,2)).reduce((a,b) => a+b)/arr.length);
    
    let f = is_rgb ? 100 : 2;
    let new_readings: number[] = (arr.length >= 20) ? arr.filter(x => x >= (mean - f*s) && x <= (mean + f*s)) : arr;
    let new_mean = new_readings.reduce((a,b) => a+b)/arr.length;
    return [new_readings, is_rgb ? Math.abs(new_mean) : new_mean];
  }



  async onConnectButtonClick() {
    await this.muse.connect();
    await this.muse.start();
    

    this.muse.eegReadings.subscribe(reading => {
      this.buffer[reading.electrode].push(this.smooth(reading.samples, reading.electrode != 3)[1] as number);
      
      let ret_list = this.smooth(this.buffer[reading.electrode], false);
      this.buffer[reading.electrode] = ret_list[0] as number[];
      let new_mean: number = ret_list[1] as number;
      if(reading.electrode != 3)
        this.part_rgb[reading.electrode] = ((new_mean % 255) > 180) ? new_mean % 255: (new_mean % 255) + 75;
      else
        this.part_rgb[reading.electrode] = new_mean
      
      if((reading.electrode != 3 && 
          this.buffer[reading.electrode].length > 3) || 
          this.buffer[reading.electrode].length > 10) {
        this.buffer[reading.electrode].pop();
      }

      let noise_str: number = 0;
      for(let i = 0; i < 4; i++) {
        if(this.buffer[i].length > 0) noise_str += this.buffer[i].reduce((a,b) => a + b)/this.buffer[i].length;
      }
      noise_str /= 4;
      this.buffer[4].push(noise_str);
      let res_str = this.smooth(this.buffer[4], true);
      this.buffer[4] = res_str[0] as number[];
      let new_noise_str: number = res_str[1] as number;

      if(this.buffer[4].length > 5) { this.buffer[4].pop(); }

      for(let i = 0; i < this.particles.length; i++) {
        this.particles[i].part_rgb = [this.part_rgb[0], this.part_rgb[1], this.part_rgb[2]];
        this.particles[i].speed = (this.part_rgb[3] > 0) ? this.part_rgb[3] % 1 + 1 : this.part_rgb[3] % 1 - 1;
        this.particles[i].noiseScale = new_noise_str % 49 + 1;
      }

      //console.log(this.buffer);

      this.p5.draw();
    });
    
     
    // this.muse.accelerometerData.subscribe(acceleration => {
    //   console.log(acceleration);
    // });

    //const leftEyeChannel = channelNames.indexOf('AF7');

    //this.leftBlinks.subscribe(
    //  value => {
        //console.log('Blink!', value);
    // }
    //)
    //this.leftBlinks = this.muse.eegReadings
    //  .filter(r => r.electrode === leftEyeChannel)
    //console.log(leftEyeChannel);
    this.muse.telemetryData.subscribe(telemetry => {
      document.getElementById('batteryLevel')!.innerText = telemetry.batteryLevel.toFixed(2) + '%';
      console.log(telemetry.batteryLevel);
      console.log("Hello1!")
    });
  }
  disconnect() {
    this.muse.disconnect();
    location.reload();
  }

}


class Particle {
  loc: any;
  dir: any;
  speed: any;
  p: any;
  noiseScale: number = 500;
  noiseStrength: number = 1;
  width: number = 700;
  height: number = 600;
  part_rgb: number[] = [255, 40, 250];

  constructor(_loc, _dir, _speed, _p, _width, _height) {
    this.loc = _loc;
    this.dir = _dir;
    this.speed = _speed;
    this.p = _p;
    this.width = _width;
    this.height = _height;
    // var col;
  }
  run() {
    this.move();
    this.checkEdges();
    this.update(this.part_rgb[0], this.part_rgb[1], this.part_rgb[2]);
  }
  move() {
    let angle = this.p.noise(this.loc.x / this.noiseScale, this.loc.y / this.noiseScale, this.p.frameCount / this.noiseScale) * Math.PI * 2 * this.noiseStrength; //0-2PI
    this.dir.x = Math.cos(angle);
    this.dir.y = Math.sin(angle);
    var vel = this.dir.copy();
    var d = 1;  //direction change 
    vel.mult(this.speed * d); //vel = vel * (speed*d)
    this.loc.add(vel); //loc = loc + vel
  }
  checkEdges() {
    //float distance = dist(width/2, height/2, loc.x, loc.y);
    //if (distance>150) {
    if (this.loc.x < 0 || this.loc.x > this.width || this.loc.y < 0 || this.loc.y > this.height) {
      this.loc.x = Math.random() * this.width * 1.2;
      this.loc.y = Math.random() * this.height;
    }
  }
  update(r, g, b) {
    this.p.fill(r, g, b);
    this.p.ellipse(this.loc.x, this.loc.y, this.loc.z);
  }
}