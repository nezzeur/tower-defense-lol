import './style.css';
import { initArt } from './art/champArt';
import { initCloud } from './cloud';
import { render } from './ui/index';

initArt().finally(render);
initCloud(() => render());
