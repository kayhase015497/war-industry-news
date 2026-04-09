import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import { BootScene }       from './scenes/BootScene.js';
import { MenuScene }       from './scenes/MenuScene.js';
import { ScenarioScene }   from './scenes/ScenarioScene.js';
import { AllocationScene } from './scenes/AllocationScene.js';
import { EventScene }      from './scenes/EventScene.js';
import { ResultScene }     from './scenes/ResultScene.js';

const config = {
  type: Phaser.AUTO,
  width:  GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  scene: [
    BootScene,
    MenuScene,
    ScenarioScene,
    AllocationScene,
    EventScene,
    ResultScene,
  ],
};

new Phaser.Game(config);
