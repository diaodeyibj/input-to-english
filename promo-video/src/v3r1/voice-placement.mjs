/** Move full recordings earlier when needed, with no waveform processing. */
export function placeEnglish(candidate){
 const start=Math.min(candidate.start_frame,Math.floor(1995-candidate.duration_seconds*60));
 if(start<1600)throw Error('Candidate is too long for the authorized English/benefits tail');
 const shift=start-candidate.start_frame;
 const result={...candidate,source_start_frame:candidate.start_frame,start_frame:start,end_frame:start+candidate.duration_seconds*60};
 for(const key of ['speech_onset_frame','speech_end_frame','first_character_frame'])if(typeof candidate[key]==='number')result[key]=candidate[key]+shift;
 for(const key of ['word_markers','character_markers'])result[key]=(candidate[key]??[]).map(m=>({...m,...(typeof m.frame==='number'?{frame:m.frame+shift}:{}),...(typeof m.start_frame==='number'?{start_frame:m.start_frame+shift}:{}),...(typeof m.end_frame==='number'?{end_frame:m.end_frame+shift}:{})}));
 return result;
}
