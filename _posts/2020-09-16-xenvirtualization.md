---
layout: post
title: "Xen and the Art of Virtualization"
categories: "2020"
tags: os virtualization
comments: true
---
<p align="center"> 
<a href="https://www.cl.cam.ac.uk/research/srg/netos/papers/2003-xensosp.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/0791e7ebcbe4f2bcd31731894055dc928f105911/posts/Xen/Xen.png" width="100%">
</a>
</p>

Xen is an x86 virtual machine monitor which allows multiple commodity operating systems to share conventional hardware in a safe and resource managed fashion,
without sacrificing either performance or functionality. Xen is type I hypervisor, which directly runs on top of bare metal.
> paravirtualization - presents a virtual machine abstraction that is similar but not identical to the underlying hardware.
<!--description-->

## The Virtual Machine Interface

**Memory** is hard to virtualize mostly because x86 doesn't sipport software-managed TLB. A tagged TLB entry allows both guest OS and hypervisor to coexist because it can be associated with an address-space identifier. This is not possible on x86, thus address space changing likely requires flushing the TLB. Thus, to achieve better performance, guest OSes are responsible to managing hardware page tables. Batching can be used by the guest OS to reduce constantly requesting new pages from the hypervisor when new processes are created.

**CPU** virtualization has implications for guest OSes. Principally, OS the most prileged entity on top of hardware. A hypersior in the middle means the guests OSes must be modified to run a lower privilege level. On x86, this is not a problem since OSes executes in ring 0 while applications execute in ring 3, leaving ring 1 and ring 2 ununsed.
Privileged instructions exeucted by the guest has to go through the check of hypervisor in general. For performance reasons, system call exceptions can be handled directly by the CPU. As for paging faults, this needs to go through the hypervisor because only code in ring 0 can result the faulting address from ```CR2```. 

**Device I/O** is implemented by transfer data between guest and Xen using shared-memory async buffer-descriptor rings. Event delivery is achieved by hypervisor sending notification to its guest asyncrhonously. When and whether to hold off these callbacks is at the discretion of the guest.

<p align="center"> 
<a href="https://www.cl.cam.ac.uk/research/srg/netos/papers/2003-xensosp.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/Xen/xen_ringbug.png" width="100%">
</a>
</p>

Essentially, the virtualization interface design is based on a number of factors. The hypersor acts as a security guard that validates the guest's request which would go directly to hardware normally if running in ring 0. The bottom line is the hypervisor shouldn't be involved unless the there are hardware limitations, or when resource validation or management are required. The goal is to separate policy from mechanism wherever possible. This similar to exokernel in that the hypervisor merely provides basic functionalities without understanding higher level issues.



## Questions
a. Why does x86 make it hard to support  efficient virtualization?  
b. How does Xen exists in 64MB section at the top of every address space avoid TLB flushes when entering and leaving the hypervisor?