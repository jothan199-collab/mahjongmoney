/* 香港麻将常见参考番表。不同牌桌对部分特殊牌型、起糊和封顶的约定不同。
   示例为重新编排的教学牌组，不能代替玩家现场核对。 */
(function(){
  const H=(id,name,score,description,example,opts={})=>({id,name,score,description,example:example||'',...opts});
  const HK=[
    H('ping','平糊',1,'四组顺子加一对将牌，没有刻子或杠。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5'),
    H('closed','门前清',1,'不吃、不碰、不明杠；暗杠是否影响门清因桌规而异。','m1 m2 m3 / m4 m5 m6 / p1 p2 p3 / s7 s8 s9 / R R',{manual:true}),
    H('self','自摸',1,'自己摸到最后一张和牌；不等于点炮。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('dragon','三元刻',1,'中、发、白任意一种组成刻子／杠，每组各计一番。','R R R / m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / E E'),
    H('seatwind','门风刻',1,'与自己座位对应的风牌刻子／杠。','E E E / m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / R R',{manual:true}),
    H('roundwind','圈风刻',1,'与当前圈风相同的风牌刻子／杠。','S S S / m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / R R',{manual:true}),
    H('noflower','无花',1,'没有花牌，是否计番要看牌桌约定。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('seatflower','正花',1,'花牌对应本人的座位，每张计一番。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('robkong','抢杠',1,'他家加杠时抢所需牌和牌。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('last','海底捞月',1,'最后一张相关牌和牌；细节按桌规确定。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('kongflower','杠上开花',2,'开杠后补牌自摸。此常用表按合计两番列示，勿再重复加自摸。','m2 m2 m2 m2 / p3 p4 p5 / s1 s2 s3 / m6 m7 m8 / E E',{manual:true}),
    H('flower4','一台花',2,'集齐同系列四张花牌／四季牌；同组是否额外计正花按桌规。','m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / p5 p5',{manual:true}),
    H('pungs','对对糊',3,'四组刻子／杠子，加一对将，没有任何顺子。','m2 m2 m2 / p4 p4 p4 / s7 s7 s7 / R R R / E E'),
    H('half','混一色',3,'只有一门数牌，加上风牌或三元牌；不能再计清一色。','m1 m2 m3 / m4 m5 m6 / m7 m8 m9 / R R R / E E'),
    H('flower7','花糊',3,'集齐七张花牌即和的特殊牌桌规则。','',{manual:true}),
    H('termhon','花幺九',4,'由一、九数牌及字牌组成刻子和将；常见表已包含对对糊。','E E E / m1 m1 m1 / p9 p9 p9 / s1 s1 s1 / G G'),
    H('small3','小三元',5,'两种三元牌刻子，第三种三元牌为将。','R R R / G G G / m1 m2 m3 / p5 p6 p7 / B B'),
    H('small4','小四喜',6,'三种风牌刻子，第四种风牌为将。','E E E / S S S / W W W / m2 m3 m4 / N N'),
    H('full','清一色',7,'全部牌只有一种数牌花色，没有风牌或三元牌。','m1 m2 m3 / m4 m5 m6 / m7 m8 m9 / m1 m1 m1 / m5 m5'),
    H('big3','大三元',8,'中、发、白三种三元牌各成一副刻子／杠。','R R R / G G G / B B B / m2 m3 m4 / p5 p5'),
    H('allclosedpungs','坎坎糊',8,'四副暗刻及一对将，是否允许暗杠要以采用规则为准。','m2 m2 m2 / p4 p4 p4 / s7 s7 s7 / R R R / E E',{manual:true}),
    H('doublekong','连杠开花',8,'连续开杠补牌而和牌的特殊牌型，具体限制依桌规。','',{manual:true}),
    H('flower8','大花糊',8,'集齐全部八张花牌的特殊和牌。','',{manual:true}),
    H('allhonor','字一色',10,'全部牌都是东南西北中发白；组成刻子／杠与将牌。','E E E / S S S / R R R / G G G / B B'),
    H('pureterm','清幺九',10,'仅由一、九数牌组成，不含字牌。','m1 m1 m1 / m9 m9 m9 / p1 p1 p1 / p9 p9 p9 / s1 s1'),
    H('nine','九莲宝灯',10,'门清单花色 1112345678999，再有同花色任意一张。','m1 m1 m1 m2 m3 m4 m5 m6 m7 m8 m9 m9 m9 m5'),
    H('big4','大四喜',13,'东南西北四种风牌各有刻子／杠。','E E E / S S S / W W W / N N N / R R'),
    H('thirteen','十三幺',13,'三门花色各一九，加东南西北中发白，共十三种，其中一张重复为将。','m1 m9 p1 p9 s1 s9 E S W N R G B E'),
    H('fourkong','十八罗汉',13,'四副杠牌加一对将，实际有 18 张牌。','m1 m1 m1 m1 / p2 p2 p2 p2 / s3 s3 s3 s3 / R R R R / E E'),
    H('heaven','天糊',13,'庄家起手符合和牌条件（含补花等细节依桌规）。','',{manual:true}),
    H('earth','地糊',13,'闲家和庄家开局第一张弃牌；具体要求以桌规为准。','',{manual:true}),
    H('human','人糊',13,'开局早期和牌的特殊规则，各地认可范围与分值不同。','',{manual:true}),
    H('seven','七对子（自订）',4,'由七个对子组成；并非所有香港牌桌都允许。','m1 m1 m3 m3 p2 p2 p4 p4 s6 s6 R R G G',{house:true}),
    H('missing','缺一门（自订）',1,'不出现某一种数牌花色；标准香港桌规一般不计。','m1 m2 m3 / m4 m5 m6 / p1 p2 p3 / p7 p8 p9 / E E',{house:true})
  ];
  const HK_DEMOS={flower4:'f1 f2 f3 f4',flower7:'f1 f2 f3 f4 / f5 f6 f7',flower8:'f1 f2 f3 f4 / f5 f6 f7 f8',heaven:'m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / E E',earth:'m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / E E',human:'m1 m2 m3 / p2 p3 p4 / s3 s4 s5 / m6 m7 m8 / E E',doublekong:'m2 m2 m2 m2 / p4 p4 p4 p4 / s3 s4 s5 / m6 m7 m8 / E E'};
  for(const rule of HK)if(HK_DEMOS[rule.id]){rule.example=HK_DEMOS[rule.id];rule.conceptOnly=true;}
  const HK_BY_ID=Object.fromEntries(HK.map(x=>[x.id,x]));
  window.MahjongFanData={HK,HK_BY_ID,source:'香港麻将常见参考番表，特别牌型和花牌按实际桌规核对。'};
})();
