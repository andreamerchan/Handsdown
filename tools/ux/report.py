import json,sys
d=json.load(open(sys.argv[1])); s=d['samples']; vh=d['vh']
n=len(s[0]['readable']); step=8
rng = d['info']['h']-d['info']['sh']
print(f"pinned scroll range: {rng}px ({rng/vh:.2f} viewports); total section {d['info']['h']}px")
for i in range(n):
    px=[x['y'] for x in s if x['readable'][i]]
    match=[x['y'] for x in s if x['readable'][i] and x['shown']==i]
    print(f"step {i+1}: readable {len(px)*step}px, readable+matching illustration {len(match)*step}px")
none=[x['y'] for x in s if 0<=x['y']<=rng and not any(x['readable'])]
mism=[x['y'] for x in s if 0<=x['y']<=rng and any(x['readable']) and not x['readable'][x['shown']] ]
print(f"inside pinned range: no readable text for {len(none)*step}px ({len(none)*step/rng:.0%}); text/illustration mismatch {len(mism)*step}px")
