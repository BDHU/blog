---
layout: post
title: "Exokernel"
categories: "2020"
tags: os
comments: true
---
Exokernel is a term every system researcher has heard of at some point in life. However, according to the [PDOS](https://pdos.csail.mit.edu/) group at MIT, there aren't any exokernel-baseed operating ssytems in active use today. It's interesting to discover what ideas exokernels brought to the OS high-level design and some potential drawbacks of such design choice.
<!--description-->

Perhaps the most important thing to keep in mind is that exokernel operating system achitecture pushes management of physical resources to the application level, contrary to what most monolithic kernel would do: providing hardware resource management through some form of abstraction, usually hiding hardware-related details.

## Limitations of Traditional Approaches
Monolithic kernels usually enforce centralized resource management via a set of abstractions. In microkernels-based system, they are usually provided through some form of trusted user-level servers. There are several drawbacks:

* Too general. Over generalizing can limit application diversity and have performance implications (domain/application-specific approach usually have performance improvements, in the cost of, well, being more "specific".). For example, in UNIX, two applications exibiting rather different memory access patterns are subject to the general-purpose OS scheduler and page relacement policy. Letting applications define such policies can  open doors for performance improvements since applications have better knowledge of their behaviors.

* Hide information. This is further expanded from the previous point. Applications tend to have better "self-awareness" and can implement customed policies that outclass the general-purpose ones provided by the kernel.

* Limited functionality. Having limited resources in hand can inhibit implementation of new ideas.

However, generalization may not be a bad thing. As discussed in the *UNIX the Timesharing System* paper, having a generalized and unified yet limited file system API can simplify programming efforts. Accessing both ordinary files and I/O devices is achieved by utilizing a unified interface. Nobody today wants to implement a different set of policies just for character device or block device.

## Design
Essentially, exokernel consists of  thin veneet that multiplexes and exports physical resrouces through a set of primitives. The libraries, running in the application space, use them to implement with special-purpose functionalities in a higher abstraction level. The architecture is shown in the Paper:

<p align="center"> 
<a href="https://pdos.csail.mit.edu/6.828/2008/readings/engler95exokernel.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/exokernel/exokernel_arch.png" width="90%">
</a>
</p>

There are three majors tasks to seperate protection from management:

* Tracking ownership of resources.

* Ensure protection by guarding resource usage.

* Revoke access.

The paper presents three techniques to achieve these goals:

* *secure binding*: lib OS can securely bind to machine resources.

* *visible revocation*: lib OS can participate in a resource revocation protocol. (Keep in mind why the revocation needs to be visible)

* *abort protocol*: exokernel itself can break secure binding of uncooperative lib OS.

In general, exokernel should expose hardware resources such as disk memory, CPU, interrupts, through low-level primitives with as few abstractions as possible. The resource management policy should be enforced by the library OS instead. **The policy control boils down to whether the exokernel permits resource allocation**.

## Secure Binding
One of the primary tasks of an exokernel is to multiplex resources securely, providing protection for mutually distrustful applications. Secure binding allows the kernel to protect resources without understanding them.

There are three techniques to implement secure bindings:
 hardware mechanisms,software caching, and downloading application code.

## Understanding Secure Binding through Examples
Secure binding is rather abstract and hard-to-comprehend concept without concrete examples. Here are some examples illustrating how secure multipleing is achieved through secure binding.

Take memory allocation for an example. When a library OS tries to allocate a physical memory page, the exokernel creates a secure binding for that page by recording the owner and the capabilities specified by the library OS. Essentially, accessing memory resources is achieved through capability. The exokernel acts as a door-keeper that checks the validity of the capability from the library OS.

I personally like to think the role of the exokernel in memory system is to act as a security guard that protects resources that can be access by the library OS through some form of interface. For example, if the hardware defines a page-table interface, which can be accessed by the lib OS, the exokernel must guard the page table. If the lib OS tries to enter a new virtual-to-physical memory mapping, then the exokernel must check the corresponding memory capability.

In summary, privileged machine operations must be guarded by the exokernel.

### Aegis: the exokernel
Up to this point I find it still hard to full understand what exokernel is capable of. Having a concret system to study for is much more helpful. So here comes Aegis.

Here is a subset of Aegis's primitives and sys call interfaces that encapsulate these exported primitves. Having a concrete list feels so much better than reading a list of abstract terms!

Here is a sublist of primitives:

|**Primitive Operations**|Description|
|----------|:-------------:|------:|
|TLBwr|Insert mapping into TLB|
|TLBvadelete|Delete virtual address from TLB|


And here is a sublist of system call interfaces:

|**System Call**|Description|
|----------|:-------------:|------:|
|Yield| Yield processor to named process|
|Alloc|Allocation of resoureces|
|Scall|Synchronous protected control transfer|

### Address Translation
It's important to first mention that Aegis provides a small number of guaranteed mappings by partitionaing an application's virtual address space into two segments. The first segments hold normal application data; the other one has guaranteed mapping and holds exception code and page-table. (Guaranteed mapping is sort of a safe lock.)

When a TLB miss happens, there are several steps happening:

* Aegis checks which segment the virtual address resides in. If it's in the standard user segmentm the exception is dispatched to the application. Otherwise, the exokernel handles the exception or forwards it to the application depends on whether there's guaranteed mapping.

* The application looks up the address in it page table, inserts TLB entry and creates capability, then invokes Aegis system routine.

* Aegis validifies the capability. Upon approval, the mapping is installed.

* Apllication resumes execution from kernel mode.

The key takeaway here is the exokernel itself is involved in very few prileged operations such as interacting directly with the hardware via low-level primitives. the bulk of the work is done in the application level.

Because the kernel contains minimal functionalities, it can be extremly fast compared to a monolithic kernel. However, does that mean the overhead is shifted to the library OS instead?

### ExOS: the Library OS
The most prominent feature about library OS is that it manages operating system abstractions at appliation level.

The GEMM operation on both ExOS and Ultrix(a monoliothic kernel OS) doesn't seem to have much difference since GEMM deosn't use any special abilities of both OSes. It does indicates that the performance gain from the minimal design of exokernel is somewhat cancelled out by the application-space overhead.

> The exokernel paper mentions that in the context of networking, the major reason for ExOS to download code is that the network buffers on our machines cannot be easily mapped into applicatin space in a secure way. Downloading the code into the kernel allows applications integrating operations such as checksim during the copy of the message from these buffers to user space. However, I'm a little bit skeptical of this statement today. Usually a highly performant TCP stack will be implemented in userspace, along with some polling (DPDK for example). But it will be interesting to compare the exokernel approach to the gigantic Linux TCP stack. The second reason is downloaded code is bounded, thus allowed full context switch to an unscheduled application.

I do find the graph in the exokernel paper interesting. It shows that when application-level message handlers are downloaded into the kernel, the roundtrip latency is almost not affected by the number of processes. Since the operation is performed inside kernel upon message arrival, no handling is needed from the application. This has the advantage that application handler is subject to scheduling, which has performance implications. (The choice of scheduler is the keybottleneck here.)

<p align="center">
<a href="https://pdos.csail.mit.edu/6.828/2008/readings/engler95exokernel.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/exokernel/throughput.png" width="80%">
</a>
</p>

## Modularity
It a natural property of exokernel since the exokernel itself is simplistic. Thus, operating system abstractions can be redefined simply by changing the lirabry OS. Thus, applications have finer-grained control over resoureces. However, I think it comes at a cost. In a monolithic kernel, applications are subject to general purpose scheduler. Having modular domain-specific schedulers can indeed improve performances, however, it might also leads to multiple scheculer contaiding, which is not covered in the paper.

## Conclusion
Exokernel does offer some new insights into system design. The simple design concept of the exokernel itself has major performance benefits as well as a limited set of primitives which gives much freedom to the application. However, that means the librabry OS has to take more responsibility. The paper didn't cover enough analytics on more general use cases. The performance gain seems to come from some highly specialized, exokernel-specific implementations of OS abstractions (such as IPC, VM, etc.). The more general case, such as GEMM, seem to be much less performance, when compared to traditional approaches. It will be good to see how exokernel performs under more diverse workloads.

I've also heard that one reason microkernels never took off was partially due to the performance slowdown compared to monolithic kernels. Since exokernel shared many similarities with microkernels (seems like exokernel is a more stripped-down version of microkernel since it barely has an OS core), it will likely fall into the same caveat. However, there doesn't seems to have a comprehensive benchmarking trials to compare all major types of kernels.
