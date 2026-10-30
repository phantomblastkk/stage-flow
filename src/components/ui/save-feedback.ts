/**
 * Transient, accessible confirmation for explicit user saves.
 * Trigger only AFTER the server/storage confirms success.
 * Navigation between local wizard steps is not a database save.
 */
export type SaveFeedbackTone="success"|"danger";
export type SaveFeedbackDetail={tone:SaveFeedbackTone;message:string;id:number};
const EVENT="stageflow:save-feedback";
let sequence=0;

export function showSaveFeedback(message:string,tone:SaveFeedbackTone="success"){
 if(typeof window==="undefined"||!message.trim())return;
 window.dispatchEvent(new CustomEvent<SaveFeedbackDetail>(EVENT,{
  detail:{tone,message:message.trim().slice(0,300),id:++sequence}
 }));
}
export const SAVE_FEEDBACK_EVENT=EVENT;
