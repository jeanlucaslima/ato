import '../ui/tokens.css';
import '../ui/popup.css';
import { loadingModel } from '../ui/model';
import { renderPopup } from '../ui/popup';

// Not wired to browser state yet: the popup shows its loading screen until the
// core (tab snapshot → PopupModel) exists.
document.body.replaceChildren(renderPopup(loadingModel()));
