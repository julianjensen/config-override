const covfefify = s => (
    [ , a, b, c] = s.match`(.*?[aeiouy]+(.)).*?([aeiouy])`,
    a + ( b = ( a = "bcdfgszkvtgp" )[ 11 - a.search( b ) ] || b ) + c + b + c
);

console.log( `${process.argv[ 2 ]} => ${covfefify( process.argv[ 2 ])}` );

// bcdfgskptvz
// sfdbgzkvtgp

// bp


// zvtgpksfdcb

// bcdfgkpstvz
// pgtvkgbzdfs      original diff

// bc
// 6 6 6 6 1 -1 -1 -6 3 -6 -6 -3

/*

 b : p
 d : t
 k : g
 c : g
 s : z
 f : v

 v : f
 z : s
 g : k
 t : d
 p : b



b:p
d:t
c:g
s:z
f:v

 */
