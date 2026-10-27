import type {Metadata} from "next";

export const metadata:Metadata={
 title:"Central privada | StageFlow",
 robots:{index:false,follow:false,noarchive:true,nosnippet:true},
};
export const dynamic="force-dynamic";
export default function OwnerAdminLayout({children}:{children:React.ReactNode}){
 return children;
}
