import Phaser from 'phaser';
import { C, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { initGlobe } from '../globe.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Dark overlay text while globe loads
    const w = GAME_WIDTH, h = GAME_HEIGHT;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, C.BG, 0.9);

    this.add.text(w / 2, h / 2 - 20, '工業力試煉', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ecf0f1',
      alpha: 0.8,
    }).setOrigin(0.5);

    const loadingText = this.add.text(w / 2, h / 2 + 24, '載入中…', {
      fontFamily: "'Noto Sans TC', sans-serif",
      fontSize: '15px',
      color: '#7f8c8d',
    }).setOrigin(0.5);

    // Animated dots
    let dots = 0;
    const dotTimer = this.time.addEvent({
      delay: 350,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4;
        loadingText.setText('載入中' + '.'.repeat(dots));
      },
    });

    // Kick off globe initialisation (async, doesn't block scene)
    const container = document.getElementById('globe-container');
    initGlobe(container).then(() => {
      dotTimer.remove();
      // Brief flash then proceed to menu
      this.tweens.add({
        targets: [overlay, loadingText],
        alpha: 0,
        duration: 600,
        onComplete: () => this.scene.start('MenuScene'),
      });
    });
  }
}
