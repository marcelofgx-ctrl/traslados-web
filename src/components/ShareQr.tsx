/** Código QR estático, generado para la dirección pública actual de Traslados.
 * No emplea proveedores externos, cookies ni rastreadores.
 * Se debe regenerar si cambia el dominio definitivo.
 */
const QR_HEX=[
  "0000000000","0000000000","0000000000","0000000000",
  "01fc42e7f0","0105cac410","017502b5d0","01749445d0","0175d755d0",
  "0105573410","01fd5557f0","000164e000","01a63c0760","00f0b9dc90",
  "00ec38eee0","013af92860","010d6b9eb0","01a125b800","00b76955f0",
  "0118ead2a0","00b5d3a820","0069190e90","013f3c0c30","001914de30",
  "0144593f40","0001a13170","01fd111520","01047f31c0","01744b9f20",
  "01751135e0","0174e501d0","0105b9d620","01fd509f20",
  "0000000000","0000000000","0000000000","0000000000",
];
const SIZE=37;
const DARK=QR_HEX.flatMap((row,y)=>
  Array.from({length:SIZE},(_,x)=>(((BigInt("0x"+row)>>BigInt(SIZE-x-1))&1n)===1n)?{x,y}:null)
    .filter((n):n is {x:number;y:number}=>Boolean(n))
);
export function ShareQr({size=160}:{size?:number}){
  return <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Código QR que abre la página de Traslados"
    viewBox="0 0 37 37" width={size} height={size} style={{width:"100%",maxWidth:size,height:"auto",aspectRatio:"1/1"}}
    shapeRendering="crispEdges">
    <title>Escaneá para abrir Traslados</title>
    <rect width="37" height="37" fill="#fffaf0"/>
    {DARK.map(({x,y})=><rect key={y*SIZE+x} x={x} y={y} width="1" height="1" fill="#102b30"/>)}
  </svg>;
}
