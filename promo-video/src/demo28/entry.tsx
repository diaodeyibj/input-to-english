import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Demo28} from './Demo';
import {FPS, FRAMES} from './timing.mjs';
const Root:React.FC=()=> <Composition id="InputToEnglishDemo28" component={Demo28} width={1920} height={1080} fps={FPS} durationInFrames={FRAMES} defaultProps={{audio:true,labels:true}}/>;
registerRoot(Root);
