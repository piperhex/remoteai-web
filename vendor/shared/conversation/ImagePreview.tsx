import { displayText } from '../localization/uiText';
import { useContext } from 'react';
import { ImageViewer } from "../chat/ImageViewer";
import { FileEnvironmentContext } from './fileEnvironment';
import { useImageMenu } from "./useImageMenu";
import styles from "./ImagePreview.module.less";
import type { ImageNavigation } from '../chat/ImageGallery';

interface Props {
  thumbnail: string;
  description: string;
  load: () => Promise<string>;
  close: () => void;
  prepare?: (url: string) => Promise<string>;
  download?: (url: string) => void | Promise<void>;
  navigation?: ImageNavigation;
}

export function ImagePreview(props: Props) {
  const menu = useImageMenu(props.prepare);
  const environment = useContext(FileEnvironmentContext);
  return <span className={styles.preview}><ImageViewer {...props} {...menu} imageMenu
    autoLoadOriginal={!environment?.remote} inlineViewControls translate={displayText} /></span>;
}
