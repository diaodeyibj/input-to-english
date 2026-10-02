import React from 'react';
import {Composition} from 'remotion';
import {Promo} from './Promo';
import {PromoV2} from './v2/Promo';
import {PromoV3} from './v3/Promo';
import {PromoV3 as PromoV3R1} from './v3r1/Promo';
export const Root:React.FC=()=> <><Composition id="InputToEnglish" component={Promo} width={1920} height={1080} fps={60} durationInFrames={1800} defaultProps={{audio:true}}/><Composition id="InputToEnglishV2" component={PromoV2} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:true}}/><Composition id="InputToEnglishV3" component={PromoV3} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:true}}/><Composition id="InputToEnglishV3R1" component={PromoV3R1} width={1920} height={1080} fps={60} durationInFrames={2400} defaultProps={{audio:true}}/></>;
