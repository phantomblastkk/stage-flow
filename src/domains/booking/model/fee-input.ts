/** Decimal BR/ISO input; blank is unknown only in formal proposals. Never accept exponent/hex notation. */
export function parseFeeInput(raw: string): number | undefined {
 const text=raw.trim();
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(text))return undefined;
 const [whole,fraction=""]=text.replace(",",".").split(".");
 const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>99999999)return undefined;
 return cents/100;
}
export function parseProposalFee(raw: string): number | null | undefined {
 return raw.trim()?parseFeeInput(raw):null;
}
