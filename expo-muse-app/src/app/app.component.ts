import { Component } from '@angular/core';
import { MuseClient, channelNames } from 'muse-js';
import { Observable, timer, of } from 'rxjs';
import * as p5 from 'p5';
import { filter } from 'rxjs/operators';

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
  buffer: number[][] = [[],[],[],[]];

  constructor() { }

  ngOnInit() {
    this.createCanvas();
  }


  private createCanvas() {
    this.p5 = new p5(this.sketch.bind(this));
    console.log(this.p5);
  }

  sketch(p: any) {

    console.log(p);
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
    
    let new_readings: number[] = arr.filter(x => x >= (mean - 2*s) && x <= (mean + 2*s));
    let new_mean = new_readings.reduce((a,b) => a+b)/arr.length;
    return is_rgb ? Math.abs(new_mean) : new_mean;
  }


  async onConnectButtonClick() {
    await this.muse.connect();
    await this.muse.start();

    this.muse.eegReadings.subscribe(reading => {
      this.buffer[reading.electrode].push(this.smooth(reading.samples, reading.electrode != 3));
      
      let new_mean: number = this.smooth(this.buffer[reading.electrode], false);
      if(reading.electrode != 3)
        this.part_rgb[reading.electrode] = ((new_mean % 255) > 180) ? new_mean % 256: (new_mean % 255) + 75;
      else
        this.part_rgb[reading.electrode] = new_mean
      
      if((reading.electrode != 3 && 
          this.buffer[reading.electrode].length >= 25) || 
          this.buffer[reading.electrode].length >= 100) {
        this.buffer[reading.electrode].pop();
      }

      let noise_str: number = 0;
      this.buffer.forEach(buf => noise_str += (buf.length > 0) ? this.smooth(buf, true) : 0);
      noise_str /= this.buffer.length;
      console.log(noise_str);

      for(let i = 0; i < this.particles.length; i++) {
        this.particles[i].part_rgb = [this.part_rgb[0], this.part_rgb[1], this.part_rgb[2]];
        this.particles[i].speed = (this.part_rgb[3] > 0) ? this.part_rgb[3] % 1.5 + 1 : this.part_rgb[3] % 1.5 - 1;
        this.particles[i].noiseScale = noise_str % 99 + 1;
      }

      console.log(this.part_rgb[3]);

      this.p5.draw();
    });
    // this.muse.telemetryData.subscribe(telemetry => {
    //   console.log(telemetry);
    // });
    // this.muse.accelerometerData.subscribe(acceleration => {
    //   console.log(acceleration);
    // });

    const leftEyeChannel = channelNames.indexOf('AF7');

    this.leftBlinks.subscribe(
      value => {
        console.log('Blink!', value);
      }
    )
    //this.leftBlinks = this.muse.eegReadings
    //  .filter(r => r.electrode === leftEyeChannel)
    console.log(leftEyeChannel);
  }
  disconnect() {
    this.muse.disconnect();
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