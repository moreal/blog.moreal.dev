---
published: 2020-02-22T00:00:00+09:00
---

How Go interface works
======================

의문
--

`utilForever/falcon`의 간단한 프로토타입을 만들면서
`CompilerProxy` 인터페이스를 구현하는 `GccCompilerProxy` 구조체를
작성하였습니다.

~~~~ go
// compiler_proxy_test.go
var compilerProxy *CompilerProxy = NewGccCompilerProxy()

// compiler_proxy.go
type CompilerProxy interface {
	AddLibrary()
	IncludeDirectory()
	Compile(srcPath, outPath string)
}

type GccCompilerProxy struct {}

func (cp *GccCompilerProxy) AddLibrary() {}

func (cp *GccCompilerProxy) IncludeDirectory() {}

func (cp *GccCompilerProxy) Compile(srcPath, outPath string) {}

func NewGccCompilerProxy() *GccCompilerProxy {
	return &GccCompilerProxy{}
}
~~~~

당연히 _`*interface` = `*struct`_ 대입이 될 거라 생각했지만
컴파일러는 제게 에러 메시지 만을 남겼습니다.

> Cannot use 'NewGccCompilerProxy()' (type \*GccCompilerProxy) as type
> \*CompilerProxy in assignment

저 컴파일 에러 메시지를 보고서 생각에 빠졌습니다.
C#에서도 `ref` 키워드를 이용할 때 `interface`와 `class` 두 타입
앞에 모두 붙였었는데 Go 에서는 뭔가 어떻게 다른 걸까라는
생각과 함께 `interface` 라는 키워드가 있는 여러 언어를 접해
보지 못했다는 것도 실감했습니다.

[A Tour of Go] 와 Go 언어로 작성된 여러 코드들을 살펴보다가
`interface{}` 와 같이 사용하는 것을 보았습니다. 그 타입은
모든 타입과 매치되고 마치 `Object` 타입 처럼 보였다.
실제로 Go는 [Reflection]도 지원합니다. 그렇다면 Go 는 [Java]나
[C#] 처럼 VM위에서 돌아가는 걸까 라는 생각도 들었지만
[FAQ]를 읽어보면 그렇지는 않다고 말하고 있었습니다.

결국 Go 안에서 `interface` 관련 작업이 어떻게 이루어지는
알아보기로 했고 이 글을 통해 정리해보고자 합니다.

[A Tour of Go]: https://tour.golang.org/
[Reflection]: https://en.wikipedia.org/wiki/Reflection_(computer_programming)
[Java]: https://en.wikipedia.org/wiki/Java_(programming_language)
[C#]: https://en.wikipedia.org/wiki/C_Sharp_(programming_language)
[FAQ]: https://golang.org/doc/faq#runtime


Interface in Go
---------------

Go Spec 레퍼런스를 보면 _인터페이스는 메소드의 집합이다_
라고 말하고 있습니다. 자바나 기타 언어에서 와는 다르게
느껴집니다. 이는 [위키피디아 Protocol(OOP)][Wikipedia Protocol]
문서에서도 말하듯 타언어에서는 명시적으로 인터페이스를
구현해야 한다에 가깝지만, Go에서는 인터페이스의 부분
집합인지를 검사하는 것에 가깝습니다. 인터페이스
검사에서 [Duck Typing] 방식을 채용하고 있기 때문입니다.
정적언어인 Go에서 이것이 어떻게 가능한 것일까요? Go
인터페이스가 어떻게 생겼고, 어떻게 다루지를 안다 면
쉽게 이해할 수 있습니다.

[Wikipedia Protocol]: https://en.wikipedia.org/wiki/Protocol_(object-oriented_programming)


Go Interface 구조체 (itab, 만드는 법)
------------------------------

Go에서 인터페이스는 `iface`라는 이름의 구조체입니다.
타입을 설명하는 `itab`의 포인터와 실제 데이터를 가리키는
포인터로 이루어져 있습니다.

~~~~ go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}
~~~~

`itab`은 해당 데이터가 어떤 인터페이스 타입이고 어떤
타입인지, 그리고 함수 테이블을 가지고 있습니다.

~~~~ go
// layout of Itab known to compilers
// allocated in non-garbage-collected memory
// Needs to be in sync with
// ../cmd/compile/internal/gc/reflect.go:/^func.dumptabs.
type itab struct {
	inter *interfacetype
	_type *_type
	hash  uint32 // copy of _type.hash. Used for type switches.
	_     [4]byte
	fun   [1]uintptr // variable sized. fun[0]==0 means _type does not implement inter.
}
~~~~

주석에서 볼 수 있듯이 코드 상에서 정적인 인터페이스
캐스팅이 있을 때 마다 `gc/subr.go#implements()` 메소드를
호출하여 캐스팅이 가능한지 검사를 합니다. 동시에 `itab`
을 생성 및 테이블에 등록합니다. 이 `itabTable`은 _.rodata_
섹션에 기록하고 실제 프로그램 실행되기 전에 가져오게
됩니다. 이와 관련된 초기화, 컴파일 과정은 다른 글에서
다뤄보도록 하겠습니다.

~~~~ go
func implements(t, iface *types.Type, m, samename **types.Field, ptr *int) bool {
	// *** codes ***
	if isdirectiface(t0) && !iface.IsEmptyInterface() {
		itabname(t0, iface)
	}
	return true
}
~~~~

위에서 볼 수 있듯이 비어있는 인터페이스, 즉
`interface{}`로의 변환은 `itab`을 생성하지 않습니다. 왜냐하면
`interface{}`의 경우 메소드를 가지지 않는 빈 인터페이스
이므ㅏ로 실제 데이터의 타입과 그 데이터를 가리키는
포인터만 가지고 있으면 충분합니다. 그래서 `eface`라는
구조체를 사용합니다.

~~~~ go
// runtime/runtime2.go
type eface struct {
	_type *_type
	data  unsafe.Pointer
}
~~~~

변환할때는 런타임시에 `runtime.convT64`, `runtime.assertE2I` 와
같은 *runtime/runtime2.go*에 작성되어 있는 함수들을
사용합니다. 어떤 함수들을 호출하게 바뀌는 지는 컴파일
과정중 만드는 SSA를 보면 쉽게 알 수 있습니다.

~~~~
$ GOSSAFUNC=func go build test.go
# command-line-arguments
dumped SSA to ./ssa.html
~~~~

![image](https://user-images.githubusercontent.com/26626194/76146532-dc173e00-60d6-11ea-973a-e5567378e15a.png)


인터페이스 메소드 호출
------------

인터페이스에서 메소드를 호출 하는 것은 `itab` 구조체의
필드 `fun` 가상 테이블에서 함수 포인터를 가져와서
실행합니다. 이 때문에 어쩔 수 없이 성능 저하가
발생합니다. 하지만 CPU 캐시 히트를 맞히면 직접 호출과
다르지 않은 속도를 기대할 수도 있습니다. 이 부분은
[다음 글]에서 잘 설명되어 있기 때문에 생략하겠습니다.

[다음 글]: https://github.com/teh-cmc/go-internals/blob/master/chapter2_interfaces/README.md


마무리
---

Golang에서 vm 없이 동적 타입을 어떻게 다루는지, interface가
어떻게 생겼는지, 컴파일러 과정 및 컴파일러 내부 코드
구조를 알 수 있어서 좋았습니다. 앞으로 go로 작성할 때
성능을 신경써야 하는 부분이 있다면 이런 캐시히트도
봐야겠구나 라는 생각이 들었습니다.


Reference
---------

 -  https://github.com/teh-cmc/go-internals/blob/master/chapter2\_interfaces/README.md
 -  https://research.swtch.com/interfaces
 -  http://www.programmersought.com/article/16341600537/
 -  https://eli.thegreenplace.net/2019/go-compiler-internals-adding-a-new-statement-to-go-part-1/
