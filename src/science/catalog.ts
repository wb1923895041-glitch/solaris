// Mean radii manually transcribed from the archived JPL physical parameter page,
// not from visual references. Sun from the archived Horizons physical header.
export const radiusSource='https://ssd.jpl.nasa.gov/planets/phys_par.html';
export interface Body { id:string; zh:string; en:string; radiusKm:number; radiusUncertaintyKm:number|null; color:string; type:string; description:string; periodYears:number|null }
export const catalog: readonly Body[] = [
 {id:'10',zh:'太阳',en:'Sun',radiusKm:695700,radiusUncertaintyKm:null,color:'#f3ad57',type:'恒星',description:'太阳系的中心恒星。行星的日心位置由同一时刻的太阳系质心状态相减得到。',periodYears:null},
 {id:'199',zh:'水星',en:'Mercury',radiusKm:2439.4,radiusUncertaintyKm:.1,color:'#b2aba2',type:'类地行星',description:'离太阳最近的行星。其轨道偏心率明显，总览中的轨迹保留真实的三维空间关系。',periodYears:.2408467},
 {id:'299',zh:'金星',en:'Venus',radiusKm:6051.8,radiusUncertaintyKm:1,color:'#dfbf80',type:'类地行星',description:'浓厚云层覆盖着金星。本期展示云层色彩示意，不将雷达地形当作可见光表面。',periodYears:.61519726},
 {id:'399',zh:'地球',en:'Earth',radiusKm:6371.0084,radiusUncertaintyKm:.0001,color:'#72b6e6',type:'类地行星',description:'我们的蓝色家园。地球中心与地月质心不同；这里使用地球本体中心 399。',periodYears:1.0000174},
 {id:'499',zh:'火星',en:'Mars',radiusKm:3389.50,radiusUncertaintyKm:.2,color:'#cc795b',type:'类地行星',description:'以红色尘土与岩质表面著称的行星。当前基础材质表达色彩与地貌类型，不用于测量。',periodYears:1.8808476},
 {id:'599',zh:'木星',en:'Jupiter',radiusKm:69911,radiusUncertaintyKm:6,color:'#d6b392',type:'气态巨行星',description:'太阳系最大的行星。可见表面是不断变化的云层，本期云带为程序示意。',periodYears:11.862615},
 {id:'699',zh:'土星',en:'Saturn',radiusKm:58232,radiusUncertaintyKm:6,color:'#d4c29b',type:'气态巨行星',description:'气态巨行星。本期只展示本体与真实轨迹，正式环系资产在后续阶段实现。',periodYears:29.447498},
 {id:'799',zh:'天王星',en:'Uranus',radiusKm:25362,radiusUncertaintyKm:7,color:'#a5d6da',type:'冰巨行星',description:'冰巨行星。淡青色大气外观为基础示意，当前不展示未经验证的环或卫星。',periodYears:84.016846},
 {id:'899',zh:'海王星',en:'Neptune',radiusKm:24622,radiusUncertaintyKm:19,color:'#6f94ce',type:'冰巨行星',description:'八大行星中距太阳最远的一颗。数据窗只覆盖其公转轨迹的一小段，不补画虚构整圈。',periodYears:164.79132}
];
