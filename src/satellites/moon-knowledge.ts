/** Descriptive science copy only. Every number shown in the panel is computed from the 3A ephemeris or 3B manifests. */
export interface MoonKnowledge{surface:string;rotation:string;missions:string;note?:string}
export const moonKnowledge:Record<string,MoonKnowledge>={
 '301':{surface:'暗色月海是古老玄武岩熔岩平原，明亮高地布满撞击坑；年轻撞击坑周围有放射状溅射纹。',rotation:'潮汐锁定，自转周期等于公转周期，总体以同一半球朝向地球；轨道偏心与自转轴倾斜造成天平动，地面累计可见约 59% 月面。本视图使用 IAU 通用姿态，不含高精度物理天平动。',missions:'Luna、Apollo（1969–1972 载人登月）、Clementine、LRO、嫦娥系列（含 2019 年首次月球背面着陆）等。',note:'局部系统以地球本体中心 399 为原点；地月质心另以标记显示，二者不混用。'},
 '401':{surface:'不规则形状，最显著的是直径约 9 km 的 Stickney 撞击坑，以及遍布表面的平行沟槽。',rotation:'潮汐锁定。轨道周期短于火星自转周期，从火星表面看西升东落；轨道在缓慢衰减。',missions:'Mariner 9、Viking 轨道器、Phobos 2、Mars Express、MRO HiRISE 等成像；JAXA MMX 计划进行采样返回。'},
 '402':{surface:'比火卫一更小、更圆滑，表面被细粒风化层覆盖，撞击坑多被填平。',rotation:'潮汐锁定。轨道更远、周期约 30 小时，略长于火星自转周期。',missions:'Mariner 9、Viking 轨道器近距离成像，Mars Express、MRO、阿联酋 Hope 号亦有观测。'},
 '501':{surface:'太阳系火山活动最剧烈的天体，表面为硫及硫化物沉积形成的黄、橙、白、黑斑驳色块与火山口。',rotation:'潮汐锁定。与 Europa、Ganymede 构成近 4:2:1 平均运动共振，受迫偏心维持强烈潮汐加热。',missions:'Voyager 1/2 首次发现活火山，Galileo 长期观测，New Horizons 掠过，Juno 2023–2024 年近距离飞掠。'},
 '502':{surface:'明亮的水冰外壳，纵横交错的线状裂纹（lineae）与混沌地形，撞击坑稀少，表面年轻。',rotation:'潮汐锁定，近 4:2:1 共振成员。冰壳下被认为存在全球性咸水海洋（科普推断，非本视图观测）。',missions:'Voyager、Galileo 成像；Europa Clipper（2024 年发射）与 ESA JUICE 正在前往木星系。'},
 '503':{surface:'太阳系最大的卫星。表面由古老暗区与较年轻、布满沟槽的亮区组成，有多处明亮撞击坑。',rotation:'潮汐锁定，近 4:2:1 共振成员；是已知唯一拥有固有磁场的卫星。',missions:'Voyager、Galileo；Juno 2021 年近距离飞掠；ESA JUICE 计划最终环绕木卫三。'},
 '504':{surface:'暗色、撞击坑极其密集的古老表面，含多环结构的 Valhalla 巨型撞击盆地。',rotation:'潮汐锁定。周期与内三颗不成简单整数比，不属于 Io–Europa–Ganymede 的拉普拉斯共振。',missions:'Voyager、Galileo；JUICE 将多次飞掠。'},
 '601':{surface:'直径约 130 km 的 Herschel 撞击坑约占卫星直径三分之一，其余地区密布撞击坑。',rotation:'潮汐锁定。IAU 模型含明显的周期项，子土星点经度摆动较其他卫星大。',missions:'Voyager 1/2、Cassini 多次成像。'},
 '602':{surface:'太阳系反照率最高的天体之一，表面近乎纯净水冰；南极有四条平行的「虎纹」断裂带，是喷流源区。',rotation:'潮汐锁定。Cassini 观测到南极羽流，为土星 E 环供给冰粒。本视图羽流仅为可开关示意教学层。',missions:'Voyager 1/2、Cassini（2005 年发现羽流并多次穿越）。'},
 '605':{surface:'灰色冰岩表面，古老高地撞击坑密集，尾随半球有明亮的细线状断崖。',rotation:'潮汐锁定。土星第二大卫星。',missions:'Voyager 1/2、Cassini。'},
 '606':{surface:'浓厚的氮–甲烷大气与橙色有机雾霾在可见光下遮蔽地表；雷达与近红外显示湖海、沙丘与河道。',rotation:'潮汐锁定。土星最大卫星，唯一拥有浓厚大气的卫星。本视图默认只显示可见光雾霾。',missions:'Voyager 1、Cassini 雷达/近红外测绘，Huygens 探测器 2005 年着陆；NASA Dragonfly 计划前往。'},
 '608':{surface:'显著的两色表面：前导半球的 Cassini Regio 极暗，尾随半球与两极明亮；赤道有高大山脊。',rotation:'潮汐锁定。轨道较远且相对土星赤道明显倾斜。',missions:'Voyager 1/2、Cassini（2007 年近距离飞掠）。'},
 '705':{surface:'拼贴式地形：多个巨大的冕状地貌（coronae）与高达约 20 km 的 Verona Rupes 断崖。',rotation:'潮汐锁定。天王星系统整体侧躺，卫星轨道随天王星赤道而非黄道。',missions:'仅 Voyager 2（1986 年）飞掠，只拍到南半球。'},
 '701':{surface:'较明亮的冰面，有大量断裂沟谷与平滑的年轻平原。',rotation:'潮汐锁定。轨道几乎位于天王星赤道面。',missions:'仅 Voyager 2（1986 年），覆盖南半球。'},
 '702':{surface:'天王星五大卫星中最暗的一颗，古老撞击坑表面，Wunda 撞击坑底有亮环。',rotation:'潮汐锁定。',missions:'仅 Voyager 2（1986 年），覆盖南半球。'},
 '703':{surface:'天王星最大卫星，撞击坑与长达上千千米的断裂峡谷系统。',rotation:'潮汐锁定。',missions:'仅 Voyager 2（1986 年），覆盖南半球。'},
 '704':{surface:'较暗、撞击坑密集的古老表面，部分坑底有暗色物质。',rotation:'潮汐锁定。天王星五大卫星中最外侧。',missions:'仅 Voyager 2（1986 年），覆盖南半球。'},
 '901':{surface:'灰色水冰表面，北极有红褐色的 Mordor Macula（被认为是冥王星逃逸大气形成的有机物沉积），赤道附近有大型峡谷带。',rotation:'与冥王星双向潮汐锁定：卡戎的自转、公转与冥王星的自转周期相同，彼此始终以同一面相对。',missions:'仅 New Horizons（2015 年 7 月）飞掠成像。',note:'卡戎位置以冥王星本体中心 999 为原点（JPL plu060 解）；系统质心位于冥王星之外。'},
 '801':{surface:'淡粉灰色氮冰表面，有「哈密瓜皮」地形、南极冠与暗色喷流痕迹。',rotation:'潮汐锁定。逆行且倾斜的轨道，被认为是被海王星俘获的柯伊伯带天体。',missions:'仅 Voyager 2（1989 年）飞掠。'}
};
/** Static search index so the main catalog can find all 18 moons before the ephemeris layer loads. */
export const moonIndex:{id:string;zh:string;en:string;parent:string}[]=[['301','月球','Moon','399'],['401','火卫一','Phobos','499'],['402','火卫二','Deimos','499'],['501','木卫一','Io','599'],['502','木卫二','Europa','599'],['503','木卫三','Ganymede','599'],['504','木卫四','Callisto','599'],['601','土卫一','Mimas','699'],['602','土卫二','Enceladus','699'],['605','土卫五','Rhea','699'],['606','土卫六','Titan','699'],['608','土卫八','Iapetus','699'],['705','天卫五','Miranda','799'],['701','天卫一','Ariel','799'],['702','天卫二','Umbriel','799'],['703','天卫三','Titania','799'],['704','天卫四','Oberon','799'],['801','海卫一','Triton','899']].map(([id,zh,en,parent])=>({id,zh,en,parent}));
