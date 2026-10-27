export type BookingMode="off"|"whatsapp"|"instagram"|"form";
export type PublicBookingContact={mode:BookingMode;phone:string|null;greeting:string};

/** Only explicitly public BR numbers; never read private phone preferences. */
export function whatsappBookingUrl(phone:string|null|undefined,greeting:string,artistName:string):string|null{
 const digits=(phone||"").replace(/\D/g,"");
 if(!/^55[1-9][0-9]{9,10}$/.test(digits))return null;
 const defaultGreeting="Olá! Vi seu perfil no StageFlow e gostaria de conversar sobre uma contratação.";
 const text=(greeting||defaultGreeting).trim().slice(0,260).replace(/\{artista\}/gi,artistName);
 return "https://wa.me/"+digits+"?text="+encodeURIComponent(text);
}
