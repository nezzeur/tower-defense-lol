import './style.css';
import { initArt } from './art/champArt';
import { render } from './ui';

initArt().finally(render);
