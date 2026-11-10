import './style.css';
import { initArt } from './art/champArt';
import { render } from './ui/index';

initArt().finally(render);
