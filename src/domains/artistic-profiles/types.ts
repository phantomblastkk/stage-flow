export const musicalTypes=["Cantor","Grupo de Pagode","Banda","Dupla","Trio","DJ","Instrumentista"] as const;
export type PerformanceProfile={id:string;account_id:string;kind:"individual"|"group"|"producer"|"venue";musical_type:string|null;name:string;bio:string;city:string;members:string[];is_public:boolean;venue_id:string|null};
export const kindLabels={individual:"Artista Individual",group:"Grupo Musical",producer:"Produtor",venue:"Casa de Show"};
