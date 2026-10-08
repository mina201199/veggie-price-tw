from PIL import Image, ImageDraw
import math, random
from pathlib import Path
p=Path(__file__).parent
random.seed(89)
for side in ['dragon','koi']:
 im=Image.new('RGB',(768,1024),(221,159,104)); d=ImageDraw.Draw(im)
 # turquoise waves wrapping the sleeve
 for k in range(19):
  pts=[(x, int(75+k*49+30*math.sin(x/90+k*.65))) for x in range(-30,800,4)]
  d.line(pts, fill=(32,84,82), width=29);d.line(pts,fill=(59,127,121),width=22);d.line([(x,y-7) for x,y in pts],fill=(171,185,148),width=3)
 # flowing dragon / koi bodies with scales
 for motif in range(3):
  cx=200+motif*180;cy=200+motif*285
  pts=[(int(cx+77*math.sin(t/16)),cy+t) for t in range(-90,145)]
  d.line(pts,fill=(62,54,37),width=105)
  d.line(pts,fill=(195,129,45) if side=='dragon' else (201,69,40),width=94)
  for j in range(13):
   y=cy-80+j*16;x=cx+77*math.sin((y-cy)/16)
   for col in range(-2,3):
    xx=x+col*17; d.arc((xx-11,y-8,xx+11,y+13),0,180,fill=(65,68,46),width=3)
  hx,hy=pts[0]
  d.ellipse((hx-52,hy-35,hx+52,hy+35),fill=(196,140,55) if side=='dragon' else (225,100,53),outline=(55,55,39),width=4)
  for dx in [-24,24]:
   d.ellipse((hx+dx-8,hy-17,hx+dx+8,hy-1),fill=(242,226,172));d.ellipse((hx+dx-3,hy-13,hx+dx+3,hy-5),fill=(25,34,31))
  if side=='dragon':
   for dx in [-30,30]: d.line([(hx+dx,hy-23),(hx+dx*1.8,hy-65),(hx+dx*1.6,hy-22)],fill=(229,199,113),width=6)
  else:
   d.polygon([(hx-48,hy+30),(hx-95,hy+65),(hx-46,hy+65)],fill=(227,159,75),outline=(62,55,40))
 # chrysanthemum hand flowers and red highlights
 for cx,cy in [(120,940),(650,530),(600,110)]:
  for a in range(12):
   ang=a*math.tau/12;x=cx+28*math.cos(ang);y=cy+28*math.sin(ang)
   d.ellipse((x-14,y-19,x+14,y+19),fill=(194,76,44),outline=(61,67,45),width=3)
  d.ellipse((cx-16,cy-16,cx+16,cy+16),fill=(220,178,78),outline=(61,67,45),width=3)
 im.save(p/(side+'.png'))
im=Image.new('RGB',(512,512));px=im.load()
for y in range(512):
 for x in range(512):
  n=random.randint(-12,12)+5*math.sin(y/18)+3*math.sin(x/11); weave=6 if (x+y)%4==0 else 0
  px[x,y]=(int(58+n+weave),int(84+n+weave),int(117+n+weave))
im.save(p/'denim.png')
