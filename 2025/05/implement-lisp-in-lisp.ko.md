---
published: 2025-05-18T00:00:00+09:00
draft: "true"
---

LISP으로 LISP 구현하기
======================

LISP을 공부하는 가장 좋은 방법은 LISP을 구현해보는
것이라는 문장을 보고 구현을 시작해본다.


LISP은 무엇인가
---------------

LISP이 무엇인지 설명하고 싶은 것은 아니고, LISP이라고 하는
것은 정확히 무엇을 의미한다고 봐야하는가? 에 대해
찾아본 것을 기록하고 싶어서 적는 단락이다. LISP은 방언이
매우 많다고 들었는데 그 중 최근에 들어서 아는 것으로는
[Common Lisp]과 [Clojure]가 있다. 근데 “LISP의 방언이 매우 많다”
라는 것 자체가 LISP이라는 것이 있다는 건데..
[위키피디아 문서][ko-wikipedia-lisp]를 보니 존 매카시라는
분이 MIT에서 1960년에 발표한 논문이 기반이고 이후 여러
실험을 통해 기능들이 생겨나고 집합이 되어 [Common Lisp]이나
[Scheme] 처럼 별개의 방언(언어)으로 취급되는 것 같다.

아무튼, 오리지널 LISP이라고 부를만한 것은
[Recursive Functions of Symbolic Expressions and Their Computation by Machine]
논문을 기반으로 하면 될 것 같다.

[Common Lisp]: https://LISP-lang.org/
[Clojure]: https://clojure.org/
[ko-wikipedia-lisp]: https://ko.wikipedia.org/wiki/%EB%A6%AC%EC%8A%A4%ED%94%84
[Recursive Functions of Symbolic Expressions and Their Computation by Machine]: https://web.archive.org/web/20040202215021/http://www-formal.stanford.edu/jmc/recursive/recursive.html


LISP 이해하기
-------------
