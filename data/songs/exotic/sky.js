c=1.047,cs=1.107,d=1.173,ds=1.243,e=1.318,f=1.392,fs=1.476,g=1.568,gs=1.656,a=1.755,as=1.862,b=1.977,
m=[0,fs,b,a,g,fs,e,fs,b/2,b,a,g,fs,e,d,cs,b/2,b,a,g,fs,g,b,a,g,fs,g,a,as,g, fs, cs],
tt=t*1.2,(sign(sinf((t*2*m[tt>>13&31]) ))*(exp(-tt/16/128%4))+sign(sinf(t*[b,a,g,fs][tt>>16&3]))*(exp(-tt/32/128%4))) /2