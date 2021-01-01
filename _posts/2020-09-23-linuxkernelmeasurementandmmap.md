---
layout: post
title: "Linux Program Measurement and mmap"
last_modified_at: 28 Sep, 2020
categories: "2020"
tags: os kernel mm linux
comments: true
---

This is a summary over Linux kernel program measurement and mmap. The specs of our experiment environment is listed below. For more details regarding the CPU spec please refer to [cpu world](http://www.cpu-world.com/CPUs/Core_i7/Intel-Core%20i7%20i7-6800K.html). This is the system spec:

| Attribute             | Value                                                                                                                                                                                                                                                                                                                                                                               |
|-----------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| Processor name (BIOS) | Intel(R) Core(TM) i7-6800K CPU @ 3.40GHz                                                                                                                                                                                                                                                                                                                                            |
| Cores                 | 6                                                                                                                                                                                                                                                                                                                                                                                   |
| Logical processors    | 12                                                                                                                                                                                                                                                                                                                                                                                  |
| TLB/Cache details     | 64-byte Prefetching   Data TLB: 1-GB pages, 4-way set associative, 4 entries   Data TLB: 4-KB Pages, 4-way set associative, 64 entries   Instruction TLB: 4-KByte pages, 8-way set associative, 64 entries   L2 TLB: 1-MB, 4-way set associative, 64-byte line size   Shared 2nd-Level TLB: 4-KB / 2-MB pages, 6-way associative, 1536 entries. Plus, 1-GB pages, 4-way, 16 entries |
| RAM                   | 32GB                                                                                                                                                                                                                                                                                                                                                                                |
| Operating System      | Ubuntu 20.04.1 LTS                                                                                                                                                                                                                                                                                                                                                                  |
| Kernel Version        | 5.4.0-47-generic                                                                                                                                                                                                                                                                                                                                               |

<br /> 
> 8-way set associative means the CPU cache is made up of sets that can fit 8 blocks each.

<!--description-->

Here are the details for the CPU cache, which we will need later:

| Cache         | L1 data               | L1 instruction        | L2                          | L3                                 |
|---------------|-----------------------|-----------------------|-----------------------------|------------------------------------|
| Size          | 6 x 32 KB             | 6 x 32 KB             | 6 x 256 KB                  | 15 MB                              |
| Associativity | 8-way set associative | 8-way set associative | 8-way set associative       | 20-way set associative             |
| Line size:    | 64 bytes              | 64 bytes              | 64 bytes                    | 64 bytes                           |
| Comments:     | Direct-mapped         | Direct-mapped         | Non-inclusive Direct-mapped | Inclusive Shared between all cores |

<br /> 

## Memory Map

To print the ```/proc/self/maps``` file for a process, we use the ```sprintf``` to construct the file name and then use the ```system``` from stdlib to cat the contents of the running process's address space. If we execute the program, it shows (also available on [gist](https://gist.github.com/BDHU/9ad2f0b6353b789cfb7c29c804a6088a#file-proc_mem_map))

```text
address                   perms offset  dev   inode                      pathname
559e3e51f000-559e3e520000 r--p 00000000 00:31 1199787                    /mnt/hdd1/Desktop/CS/CS380L/Lab1/a.out
559e3e520000-559e3e521000 r-xp 00001000 00:31 1199787                    /mnt/hdd1/Desktop/CS/CS380L/Lab1/a.out
559e3e521000-559e3e522000 r--p 00002000 00:31 1199787                    /mnt/hdd1/Desktop/CS/CS380L/Lab1/a.out
559e3e522000-559e3e523000 r--p 00002000 00:31 1199787                    /mnt/hdd1/Desktop/CS/CS380L/Lab1/a.out
559e3e523000-559e3e524000 rw-p 00003000 00:31 1199787                    /mnt/hdd1/Desktop/CS/CS380L/Lab1/a.out
7faf5c477000-7faf5c49c000 r--p 00000000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c49c000-7faf5c614000 r-xp 00025000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c614000-7faf5c65e000 r--p 0019d000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c65e000-7faf5c65f000 ---p 001e7000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c65f000-7faf5c662000 r--p 001e7000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c662000-7faf5c665000 rw-p 001ea000 08:22 11932543                   /usr/lib/x86_64-linux-gnu/libc-2.31.so
7faf5c665000-7faf5c66b000 rw-p 00000000 00:00 0 
7faf5c685000-7faf5c686000 r--p 00000000 08:22 11932535                   /usr/lib/x86_64-linux-gnu/ld-2.31.so
7faf5c686000-7faf5c6a9000 r-xp 00001000 08:22 11932535                   /usr/lib/x86_64-linux-gnu/ld-2.31.so
7faf5c6a9000-7faf5c6b1000 r--p 00024000 08:22 11932535                   /usr/lib/x86_64-linux-gnu/ld-2.31.so
7faf5c6b2000-7faf5c6b3000 r--p 0002c000 08:22 11932535                   /usr/lib/x86_64-linux-gnu/ld-2.31.so
7faf5c6b3000-7faf5c6b4000 rw-p 0002d000 08:22 11932535                   /usr/lib/x86_64-linux-gnu/ld-2.31.so
7faf5c6b4000-7faf5c6b5000 rw-p 00000000 00:00 0 
7ffcddb8d000-7ffcddbae000 rw-p 00000000 00:00 0                          [stack]
7ffcddbe0000-7ffcddbe3000 r--p 00000000 00:00 0                          [vvar]
7ffcddbe3000-7ffcddbe4000 r-xp 00000000 00:00 0                          [vdso]
ffffffffff600000-ffffffffff601000 --xp 00000000 00:00 0                  [vsyscall]
```

Based on the [linux man page](https://man7.org/linux/man-pages/man5/proc.5.html), we can see each column has different definition. The *address* field is the address space in the process that the mapping occupies. The *perms* field is a set of permissions:

* r = read
* w = write
* x = execute
* s = shared
* p = private (copy on write)

The *offset* field is the offset into the file/whatever; *dev* is the device (major:minor); *inode* is the inode on that device. 0 indicates that no inode is associated with the memory region, as would be the case with BSS (uninitialized data).  

The *pathname* field will usually be the file that is backing the mapping.  For ELF files, you can easily coordinate with the *offset* field by looking at the Offset field in the ELF program headers (readelf -l). In addition, we can see a few other pseudo-paths:

* *\[stack\]*: the initial process's (also known as the main thread's) stack.
* *\[vdso\]*: The virtual dynamically linked shared object. More detailed descritpions can be found on [lwn](https://lwn.net/Articles/615809/).
* *\[vvar\]*: location of kernel space variables mapped in user space needed by virtual system calls. Essentially, a kernel-space physical address is mapped into the userspace.
* *\[vsyscall\]*: similar to vDSO, vsyscall is another segement used to accelerate certain system calls in Linux. Vsyscall has some limitations; among other things, there is only space for a handful of virtual system calls. More detailed descriptions can be found on [lwn](https://lwn.net/Articles/446528/).

One thing interesting here is that when we execute the same program twice, we can see after the first run, the output is

```text
7fffbc92f000-7fffbc930000 r-xp 00000000 00:00 0                          [vdso]
ffffffffff600000-ffffffffff601000 --xp 00000000 00:00 0                  [vsyscall]
```

Type the same command again:

```text
7ffd6a94d000-7ffd6a94e000 r-xp 00000000 00:00 0                          [vdso]
ffffffffff600000-ffffffffff601000 --xp 00000000 00:00 0                  [vsyscall]
```

Note that the vDSO area has moved, while the vsyscall page remains at the same location. The location of the vsyscall page is nailed down in the kernel ABI, but the vDSO area - like most other areas in the user-space memory layout - has its location randomized every time it is mapped. The vsyscall is lecacy implementation of user-space sys call accelration. Since it has fixed addresses, it is vulnerable to security issues. Because applications depend on the existence and exact address of that page, most functions are simply removed and replaced by a special trap instruction. More detailed explanation can be found on [lwn.net](https://lwn.net/Articles/446528/).

Another interesting thing we observed is the base address of the executable (the start of the text section) and the start address of libc is rather different. This is also the result of using ASLR which is used to prevent return-to-libc attack.

## getrusage

Then, we call ```getrusage``` at the end of our program and print out the fields. We will need ```getrusage``` later. Here is a sample output for some fields inside ```struct rusage```:

```text
utime: 1306
stime: 0
maxrss: 2692
minflt: 76
majflt: 0
inblock: 0
oublock: 0
nvcsw: 2
nivcsw: 0
```

Here is a short list of descriptions for each of these fields. More detailed information can be found on [gnu website](https://www.gnu.org/software/libc/manual/html_node/Resource-Usage.html)

* **utime**: time spent executing user instructions.
* **stime**: time spent in operating system code on behalf of processes.
* **maxrss**: the maximum resident set size used, in kilobytes. That is, the maximum number of kilobytes of physical memory that processes used simultaneously.
* **minflt**: the number of page faults which were serviced without requiring any I/O.
* **majflt**: the number of page faults which were serviced by doing I/O.
* **inblock**: the number of times the file system had to read from the disk on behalf of processes.
* **oublock**: the number of times the file system had to write to the disk on behalf of processes.
* **nvcsw**: the number of times processes voluntarily invoked a context switch (usually to wait for some service).
* **nivcsw**: the number of times an involuntary context switch took place (because a time slice expired, or another process of higher priority was scheduled).

## perf_event_open

```perf_event_open``` interface is useful to measurement numerous system events. However, glibc doesn't provide wrapper for this system call. Instead, we need to use ```syscall``` directly.

To use ```perf_event_open```, we call create a function wrapper that does the actual syscall for us. Take the example from the [Linux man page](https://man7.org/linux/man-pages/man2/perf_event_open.2.html)

```c
static int
perf_event_open(struct perf_event_attr *hw_event, pid_t pid,
                int cpu, int group_fd, unsigned long flags)
{
    int ret;

    ret = syscall(__NR_perf_event_open, hw_event, pid, cpu,
                    group_fd, flags);
    return ret;
}
```

Here the ```__NR_perf_event_open``` specifies the syscall number. On our local machine, we can go to ```/usr/include/x86_64-linux-gnu/sys/syscall.h```, which specifies the location of ```__NR_perf_event_open```. In our case, it is located at ```/usr/include/x86_64-linux-gnu/asm/unistd_64.h```.

If we call ```objdump -d``` on the binary file, we will see soemthing like this

```text
000000000000119a <perf_event_open>:
    119a:	55                   	push   %rbp
    119b:	48 89 e5             	mov    %rsp,%rbp
    119e:	48 83 ec 30          	sub    $0x30,%rsp
    11a2:	48 89 7d e8          	mov    %rdi,-0x18(%rbp)
    11a6:	89 75 e4             	mov    %esi,-0x1c(%rbp)
    11a9:	89 55 e0             	mov    %edx,-0x20(%rbp)
    11ac:	89 4d dc             	mov    %ecx,-0x24(%rbp)
    11af:	4c 89 45 d0          	mov    %r8,-0x30(%rbp)
    11b3:	48 8b 7d d0          	mov    -0x30(%rbp),%rdi
    11b7:	8b 75 dc             	mov    -0x24(%rbp),%esi
    11ba:	8b 4d e0             	mov    -0x20(%rbp),%ecx
    11bd:	8b 55 e4             	mov    -0x1c(%rbp),%edx
    11c0:	48 8b 45 e8          	mov    -0x18(%rbp),%rax
    11c4:	49 89 f9             	mov    %rdi,%r9
    11c7:	41 89 f0             	mov    %esi,%r8d
    11ca:	48 89 c6             	mov    %rax,%rsi
    11cd:	bf 2a 01 00 00       	mov    $0x12a,%edi
    11d2:	b8 00 00 00 00       	mov    $0x0,%eax
    11d7:	e8 84 fe ff ff       	callq  1060 <syscall@plt>
    11dc:	89 45 fc             	mov    %eax,-0x4(%rbp)
    11df:	8b 45 fc             	mov    -0x4(%rbp),%eax
    11e2:	48 98                	cltq   
    11e4:	c9                   	leaveq 
    11e5:	c3                   	retq   
```

We notice there's one interesting line

```text
callq  1060 <syscall@plt>
```

The ```plt``` stands for Procesure Linkage Table. This lines indicates a call to the ```syscall``` in the procedure linking table. The PLT allows us to resolve the absolute addresses of shared libraries at runtime.

Take a look at the ```<syscall@plt>``` section of the disassembly of section .plt, we see

```text
0000000000001060 <syscall@plt>:
    1060:	ff 25 62 2f 00 00    	jmpq   *0x2f62(%rip)    #3fc8<syscall@GLIBC_2.2.5>
    1066:	68 03 00 00 00       	pushq  $0x3
    106b:	e9 b0 ff ff ff       	jmpq   1020 <.plt>
```

Notice this jump is a pointer to an address. The address lies inside the GOT (Global Offset Table). The GOT will eventually hold the absolute address call to ```syscall```. On the first call the address will point back to the instruction after the jump in the PLT - ```0x1066```. Then we see another jump instruction. This jump is a jump into the eventual runtime linker code that will load the shared library which has syscall.

We also see the comment for the first jump instruction

```text
#3fc8<syscall@GLIBC_2.2.5>
```

Use ```objdump -R```, we see the dynamic relocation entries in the file

```text
DYNAMIC RELOCATION RECORDS
OFFSET           TYPE              VALUE 
0000000000003d98 R_X86_64_RELATIVE  *ABS*+0x0000000000001190
0000000000003da0 R_X86_64_RELATIVE  *ABS*+0x0000000000001150
0000000000004008 R_X86_64_RELATIVE  *ABS*+0x0000000000004008
0000000000003fd8 R_X86_64_GLOB_DAT  _ITM_deregisterTMCloneTable
0000000000003fe0 R_X86_64_GLOB_DAT  __libc_start_main@GLIBC_2.2.5
0000000000003fe8 R_X86_64_GLOB_DAT  __gmon_start__
0000000000003ff0 R_X86_64_GLOB_DAT  _ITM_registerTMCloneTable
0000000000003ff8 R_X86_64_GLOB_DAT  __cxa_finalize@GLIBC_2.2.5
0000000000003fb0 R_X86_64_JUMP_SLOT  getpid@GLIBC_2.2.5
0000000000003fb8 R_X86_64_JUMP_SLOT  __stack_chk_fail@GLIBC_2.4
0000000000003fc0 R_X86_64_JUMP_SLOT  system@GLIBC_2.2.5
0000000000003fc8 R_X86_64_JUMP_SLOT  syscall@GLIBC_2.2.5
0000000000003fd0 R_X86_64_JUMP_SLOT  sprintf@GLIBC_2.2.5
```

<!-- If we take a look at instruction ```1020```, we see

```text
0000000000001020 <.plt>:
    1020:	ff 35 7a 2f 00 00    	pushq  0x2f7a(%rip)        # 3fa0 <_GLOBAL_OFFSET_TABLE_+0x8>
    1026:	ff 25 7c 2f 00 00    	jmpq   *0x2f7c(%rip)        # 3fa8 <_GLOBAL_OFFSET_TABLE_+0x10>
    102c:	0f 1f 40 00          	nopl   0x0(%rax)
``` -->

## Monitor Events

Next, we are going to look at L1 data cache metrics. We are interested in L1 data cache accesses, misses, and data TLB misses. We will measure this code in our experiment. CACHE_LINE_SIZE is defined as 64 to match our CPU specs.

```c
// p points to a region that is 1GB (ideally)
void do_mem_access(char* p, int size) {
    int i, j, count, outer, locality;
    int ws_base = 0;
    int max_base = ((size / CACHE_LINE_SIZE) - 512);
    for(outer = 0; outer < (1<<20); ++outer) {
      long r = simplerand() % max_base;
      // Pick a starting offset
      if( opt_random_access ) {
         ws_base = r;
      } else {
         ws_base += 512;
         if( ws_base >= max_base ) {
            ws_base = 0;
         }
      }
      for(locality = 0; locality < 16; locality++) {
         volatile char *a;
         char c;
         for(i = 0; i < 512; i++) {
            // Working set of 512 cache lines, 32KB
            a = p + (ws_base + i) * CACHE_LINE_SIZE;
            if((i%8) == 0) {
               *a = 1;
            } else {
               c = *a;
            }
         }
      }
   }
}
```

What this routine does is essentially pick a working set of 512 cache lines, periodically perform a write or otherwise read operation. This process is repeated 16 times during each interation. Each read or write access will operate on a new cache line. The innermost loop will perform this set of operations for the entire L1 data cache.

When opt_random_access is true, the starting base adress of the cache line is randomly picked. Otherwise, it is incremented by 512 cache lines (or one working set) during each outer iteration. The main difference is that with opt_random_access set to true, the starting base address of the cache line can't be precomputed by the hardware, thus likely increase miss rate.




To measure L1 data cache metrics, we will use the ```perf_event_open``` interface we discussed above. To measure L1 data cache read misses, we will configure our ```struct perf_event_attr``` as follows:

```c
#define CALC_CONFIG(perf_hw_cache_id, perf_hw_cache_op_id, perf_hw_cache_op_result_id) \
((perf_hw_cache_id) | (perf_hw_cache_op_id << 8) | (perf_hw_cache_op_result_id << 16))

hw_event.type = PERF_TYPE_HW_CACHE; 
hw_event.size = sizeof(struct perf_event_attr);
hw_event.disabled = 1; // disable at init time
hw_event.exclude_kernel = 1;
hw_event.config = CALC_CONFIG(PERF_COUNT_HW_CACHE_L1D, PERF_COUNT_HW_CACHE_OP_READ, PERF_COUNT_HW_CACHE_RESULT_ACCESS);
```

The exact details can be found in [linux man page](https://man7.org/linux/man-pages/man2/perf_event_open.2.html). The important part is:

```c
hw_event.config = CALC_CONFIG(PERF_COUNT_HW_CACHE_L1D, PERF_COUNT_HW_CACHE_OP_READ, PERF_COUNT_HW_CACHE_RESULT_ACCESS);
```

These configurations allows us to measure the L1 data cahe read misses. The arguments passed to ```perf_event_open``` is

```c
pid_t pid = 0;
int cpu = -1;
int group_fd = -1;
unsigned long flags = 0;
```

The choice of these parameters can also be found on the [linux man page](https://man7.org/linux/man-pages/man2/perf_event_open.2.html). After ```perf_event_open``` is called, we will re-enable event measurements by calling

```c
ioctl(fd, PERF_EVENT_IOC_RESET, 0);
ioctl(fd, PERF_EVENT_IOC_ENABLE, 0);
```

What it does is resetting the event count specified by the file descriptor argument to zero, then enables the individual event specified by the file descriptor argument. After ```do_mem_access(p, size)``` is executed, we call ```ioctl(fd, PERF_EVENT_IOC_DISABLE, 0)``` to disable the event and then read the result by ```read(fd, &result, sizeof(long long))```. How result is defined is up to how ```PERF_FORMAT_*``` was specified. You can also check [lxr](https://elixir.bootlin.com/linux/latest/source/kernel/events/core.c#L1833) to see how ```__perf_event_read_size``` calculates the size of event that is read. In our case, it's simple a ```u64```.

> Be aware that simply executing the binary might cause ```perf_event_open``` to fail (in which case will always return -1). Using ```sudo``` is one workaround. Execute ```cat /proc/sys/kernel/perf_event_paranoid``` and see what returns. ```-1``` means you have raw access to kernel tracepoints. Otherwise, you might have trouble accessing the performance counter without root privilege. Check this [stackexchange post](https://unix.stackexchange.com/questions/14227/do-i-need-root-admin-permissions-to-run-userspace-perf-tool-perf-events-ar) for more details.

To be even more careful about generating repeatable results we should flush the level 1 data cache before enabling the performance counters. We will do this by reading a memory buffer larger than per-core L1 data cache size

```c
size_t buffer_size = 32 * 1024 + 1024;
char *buff = malloc(buffer_size);
for (int i = 0; i < buffer_size; i++) {
    buff[i] = rand();
}
```

We will also lock the process onto a single processor by using the ```sched_setaffinity``` function. Our example is

```c
cpu_set_t set;
CPU_ZERO(&set);
CPU_SET(7, &set);
int aff = sched_setaffinity(0, sizeof(cpu_set_t), &set);
```

We perform the each of the above experiments 5 times. First, we turn on random cache line base address generation. On average, we have around 1010665367 L1 data cache read misses wtih standard deviation to be 61010967 misses. When random access is disabled, we have on average 964420324 read misses with standard deviation of 65787193 misses. We can also measure the number L1 data cache write misses by using the ```PERF_COUNT_HW_CACHE_OP_WRITE``` config instead. Use ```PERF_COUNT_HW_CACHE_OP_PREFETCH``` gives us prefetch misses, in our case, both of these metrics are unavailable. We can check the ```/arch/x86/events/intel/core.c``` in [lxr](https://elixir.bootlin.com/linux/v5.6/source/arch/x86/events/intel/core.c) and we can see these metrics are not available.

We can also use the ```PERF_COUNT_HW_CACHE_DTLB``` config option for data TLB measurement. For read access we have on average 3390719 misses with std dev being 17579, while write access has 1486451 misses with std dev being 13455. The prefetch metrics for TLB are unavailable in our case. To find out more about available metrics supported, please check the constant ```static __initconst const u64 skl_hw_cache_event_ids``` for specific kernel version.

With random cache line access turned off, we have 517335 read misses data TLB with standard deviation of 3820 misses. For write we have on average 809671 misses with standard deviation being 9580 misses. It is a significant reduction compared to the random access implementation.

To calculate the L1 cache miss rate and data TLB miss rate, we can use 100.0 \* cache misses / cache_accesses and 100.0 \* tlb misses / cache_accesses to calculate the results. With random access turned off, we get L1 read access miss rate to be $$miss_{cache} = 1.5\%$$ and TLB read miss rate $$miss_{tlb} \approx 0$$. When random access is turned on, we have $$miss_{cache} = 1.4\%$$ and $$miss_{tlb} \approx 0$$. We can see the miss rate in all scenarios is really low. This is mainly because the inner most loop in our routine is performing operations on working set already presented in L1 cache and TLB. The read/write operations use continous cache lines, which means there will almost be no faults while we access the 512 cache lines. If one fault causes the entire new working set to be cached, then there would be no subsequent faults until the entire working set is iterated.

If we use ```getrusage``` we can see the metrics listed below:

| Metrics | Mean    | std dev |
|---------|---------|---------|
| utime   | 868629  | 126044  |
| stime   | 253586  | 20112   |
| maxrss  | 1049691 | 43      |
| minflt  | 262214  | 1       |
| majflt  | 0       | 0       |
| inblock | 0       | 0       |
| oublock | 0       | 0       |
| nvcsw   | 0.4     | 0.54    |
| nivcsw  | 47      | 7       |

<br />

## mmap

Next we are going to explore the behavior of mmap. Previously, we used ```malloc``` for data allocation. Next, we are going to instead use ```mmap``` and see what happens. Here we will only use read access for benchmark metrics since it's available in both L1 and TLB metrics.

First, we use the ```MAP_ANONYMOUS``` as a flag passed to ```mmap```. This flag means the mapping is not backed by any file; its contents are initialized to zero. The complete call is

```c
mmap(NULL, length, PROT_READ | PROT_WRITE,
                MAP_PRIVATE | MAP_ANONYMOUS, fd_ignore, offset);
```

For more details, refer to [mmap man page](https://man7.org/linux/man-pages/man2/mmap.2.html) for information.

When we turn on the random access and use ```perf_event_open``` interface to collect metrics, we see the L1 data cache read misses are 956148031 (std dev 84631843). The TLB data cache read misses are 3370309 (std dev 17792). We see it is not really different to the malloc approach we used before. Doing a simple ```strace``` shows ```malloc``` calls ```mmap```. The memory that backs  ```malloc()``` allocations is handled by the kernel in much the same way as the memory that backs private anonymous mappings created with ```mmap()```.

Then, we try to use ```mmap()``` to create mapping in the virtual address space backed by a file instead of using ```MAP_ANONYMOUS```.

We first test ```mmap``` with ```MAP_PRIVATE```. According to the man page, this flags means creating a private copy-on-write mapping.  Updates to the mapping are not visible to other processes mapping the same file, and are not carried through to the underlying file.  It is unspecified whether changes made to the file after the mmap() call are visible in the mapped region.

> Note we should call ```fallocate()``` for the newly created file, otherwise mmap is gonna throw bur error.

When we measure the L1 data cache miss, it's around 946128512 (std dev 956148031), nothing special happens. When we use ```MAP_SHARED``` flag, the result was similar. The result seems to fluctuates as time passes, but overall they are not much different. After all, it's just reading from the memory, whether the address is backed by a file or not doesn't play a big role in affecting the cache miss rate. The L1 data cache misses is shown below:

| Flag    | PRIVATE   | PRIVATE+POPULATE | SHARED    | SHARED+POPULATE |
|---------|-----------|------------------|-----------|-----------------|
| Mean    | 783864673 | 769314361        | 842915231 | 816749524       |
| Std dev | 77816766  | 53913082         | 54613278  | 60580595        |

<br />

If we take a look at TLB data cache, the result is

| Flag    | PRIVATE | PRIVATE+POPULATE | SHARED  | SHARED+POPULATE |
|---------|---------|------------------|---------|-----------------|
| Mean    | 3372303 | 3370740          | 3381755 | 3377370         |
| Std dev | 9884    | 13567            | 17626   | 11776           |

<br />

Still, there doesn't seem have any significant fluctuation in the number of misses in data TLB. This pattern also applies to sequential access, except the TLB data cache misses is alot lower in sequentual access.

Now If we instead use ```getrusage()```, we will get something like this

| Flag            | PRIVATE       | PRIVATE+POPULATE | SHARED         | SHARED+POPULATE |
|-----------------|---------------|------------------|----------------|-----------------|
| Usec/std dev    | 20/0          | 20/0             | 20/0           | 20/0            |
| usec/std dev    | 801512/ 78346 | 793452/ 143556   | 872342/ 124124 | 671957/ 229314  |
| Ssec/std dev    | 0/0           | 0/0              | 0/0            | 0/0             |
| ssec/std dev    | 475977/ 54355 | 475678/ 134253   | 445467/ 99345  | 536041/ 98797   |
| oublock/std dev | 0/0           | 0/0              | 2997152/ 82256 | 2097152/ 19760  |

<br />

The most interesting part here is when ```MAP_SHARED``` is enabled, the ```oublock``` immediately changes. As we mentioned previously, ```oublock``` specifies the number of times the file system had to write to the disk on behalf of processes. Because the address is now backed by a file, all write operations will cause the file system to write the contents back to the file.

```mmap()``` creates a new mapping in the virtual address space of the
calling process. However, it doesn't allocate RAM. If we call ```memset()``` then followed by ```msync()``` with ```MS_SYNC``` flag, we can get some interesting results in ```getrusage```, these observations are summarized here:

* kernel space time is much higher. It usually take 1 sec (no std dev) as opposed to 0. Synchronizing to files on disk will require more kernel participation.
* minflt (the number of page faults which were serviced without requiring any I/O) was muich higher, the value is around 540782(std dev 3). More memory mapped means the faults by I/O will be less likely.
* oublock is much higher, the value is around 4196512(std dev 1). The sync operating means there will be approximatly double amount of writes to disk.
* nvcsw was higher, there are more voluntary context switches. Writing results to disk has delay, and thus the process likely need to context switch while waiting for I/O to be finished.

We may notice the number data TLB misses is lower than the total number of page the application uses. One obvious answer the use of huge page. One huge page can cover many small pages. Also, because we have prefetching TLB and the working set access pattern is contiguous, TLB hit rate will be high. Because we have a set-associative TLB cache, and we access the memory in a fairly deterministic way, it's easy to predict where the next access is pointing to. For example, if the replacement policy is FIFO, then each cache line will remain untouched for exact same clock cycle before replaced. This also applies to other policies. One way to determine the replacement algorithm is using P-Chase.

## strace

We then use ```strace``` to trace syscalls of our application. The output contains some interesting information, one is

```
access("/etc/ld.so.preload", R_OK)      = -1 ENOENT (No such file or directory)
...
arch_prctl(ARCH_SET_FS, 0x7fdc6ad83540) = 0
```

According to [arch_prctl man page](https://man7.org/linux/man-pages/man2/arch_prctl.2.html), ```arch_prctl()``` sets architecture-specific process or thread state. The ```ARCH_SET_FS``` option sets the 64-bit base for the FS register to addr, in our case it's 0x7fdc6ad83540. Let's set a break point at ```arch_prctl``` and backtrace from there

```text
#0  0x00007ffff7febb55 in ?? () from /lib64/ld-linux-x86-64.so.2
#1  0x00007ffff7fd104c in ?? () from /lib64/ld-linux-x86-64.so.2
#2  0x00007ffff7fd0108 in ?? () from /lib64/ld-linux-x86-64.so.2
#3  0x0000000000000001 in ?? ()
#4  0x00007fffffffe2fa in ?? ()
#5  0x0000000000000000 in ?? ()
```

We can see the FS segment base is set by the ```ld-linux```, which is a part of glibc, during the program loading. A simple google seach tells us ```/lib64/ld-linux-x86-64.so.2``` is a dynamic linker. A more detailed description can be found on this [post](https://unix.stackexchange.com/questions/400621/what-is-lib64-ld-linux-x86-64-so-2-and-why-can-it-be-used-to-execute-file) and [lwn.net](https://lwn.net/Articles/631631/). During the startup, the loader initalizes TLS. The includes memory allocation and setting FS base value to point to the TLS beignning, which is done via the ```arch_prctl``` syscall. More can be found [here](https://unix.stackexchange.com/questions/453749/what-sets-fs0x28-stack-canary/453772). This ```init_tls()``` is called [here](https://git.launchpad.net/glibc/tree/elf/rtld.c?id=916124ed841745b7a1e0fbc43f9909340b47d373#n1397), which subsequently calls the actuall [syscall](https://git.launchpad.net/glibc/tree/sysdeps/x86_64/nptl/tls.h#n153) in ```tls.h```.

The /etc/ld.so.preload has similarities to LD_PRELOAD, in addition, it doesn't suffer security limitation posed by LD_PRELOAD ([explanation here](https://superuser.com/questions/1183037/what-is-does-ld-so-preload-do)). This a feature of *glibc*.

<!-- ## Measuring memory access behavior 

First we thought having more background processes running will have effect on the application behavior. The gnome desktop envionrment consists of dozens of processes running at the same time. However, there doesn't seem to have any difference when we turned off the DE. This is mostly due to the fact the workload is not heavy enough to contend resources with our pplication. Inspired by the contention experiement, we instead uses the kenrel compilation as the ''background activity''. We use -j flag to spawn more processes than the number of physical cores. This will create more opportuniteis for context switches and higher memory utilization. The most significant changes we see is the change in nivcsw. Previously, the number can reach 0 very often. However, as we create more background processes the value of nivcsw increases dramatically. Our cases shows around 234 switches on average with standard deviation being 123. -->

## Competing for Memory

Next we are going to fork another process that will compete for memory with our process under test. We will use this code snippet which is going to be executed by both the parent and the child process

```c
int compete_for_memory(void* unused) {
   long mem_size = get_mem_size();
   int page_sz = sysconf(_SC_PAGE_SIZE);
   printf("Total memsize is %3.2f GBs\n",
         (double)mem_size/(1024*1024*1024));
   fflush(stdout);
   char* p = mmap(NULL, mem_size, PROT_READ | PROT_WRITE,
                  MAP_NORESERVE|MAP_PRIVATE|MAP_ANONYMOUS, -1, (off_t) 0);
   if (p == MAP_FAILED)
      perror("Failed anon MMAP competition");

   int i = 0;
   while(1) {
      volatile char *a;
      long r = simplerand() % (mem_size/page_sz);
      char c;
      if( i >= mem_size/page_sz ) {
         i = 0;
      }
      // One read and write per page
      //a = p + i * page_sz; // sequential access
      a = p + r * page_sz;
      c += *a;
      if((i%8) == 0) {
         *a = 1;
      }
      i++;
   }
   return 0;
}
```

The ```get_mem_size()``` is implemented using this [portable code](https://stackoverflow.com/questions/22670257/getting-ram-size-in-c-linux-non-precise-result)

```c
#if defined(_WIN32)
#include <Windows.h>

#elif defined(__unix__) || defined(__unix) || defined(unix) || (defined(__APPLE__) && defined(__MACH__))
#include <unistd.h>
#include <sys/types.h>
#include <sys/param.h>
#if defined(BSD)
#include <sys/sysctl.h>
#endif

#else
#error "Unable to define getMemorySize( ) for an unknown OS."
#endif

/**
 * Returns the size of physical memory (RAM) in bytes.
 */
size_t getMemorySize( )
{
#if defined(_WIN32) && (defined(__CYGWIN__) || defined(__CYGWIN32__))
    /* Cygwin under Windows. ------------------------------------ */
    /* New 64-bit MEMORYSTATUSEX isn't available.  Use old 32.bit */
    MEMORYSTATUS status;
    status.dwLength = sizeof(status);
    GlobalMemoryStatus( &status );
    return (size_t)status.dwTotalPhys;

#elif defined(_WIN32)
    /* Windows. ------------------------------------------------- */
    /* Use new 64-bit MEMORYSTATUSEX, not old 32-bit MEMORYSTATUS */
    MEMORYSTATUSEX status;
    status.dwLength = sizeof(status);
    GlobalMemoryStatusEx( &status );
    return (size_t)status.ullTotalPhys;

#elif defined(__unix__) || defined(__unix) || defined(unix) || (defined(__APPLE__) && defined(__MACH__))
    /* UNIX variants. ------------------------------------------- */
    /* Prefer sysctl() over sysconf() except sysctl() HW_REALMEM and HW_PHYSMEM */

#if defined(CTL_HW) && (defined(HW_MEMSIZE) || defined(HW_PHYSMEM64))
    int mib[2];
    mib[0] = CTL_HW;
#if defined(HW_MEMSIZE)
    mib[1] = HW_MEMSIZE;            /* OSX. --------------------- */
#elif defined(HW_PHYSMEM64)
    mib[1] = HW_PHYSMEM64;          /* NetBSD, OpenBSD. --------- */
#endif
    int64_t size = 0;               /* 64-bit */
    size_t len = sizeof( size );
    if ( sysctl( mib, 2, &size, &len, NULL, 0 ) == 0 )
        return (size_t)size;
    return 0L;          /* Failed? */

#elif defined(_SC_AIX_REALMEM)
    /* AIX. ----------------------------------------------------- */
    return (size_t)sysconf( _SC_AIX_REALMEM ) * (size_t)1024L;

#elif defined(_SC_PHYS_PAGES) && defined(_SC_PAGESIZE)
    /* FreeBSD, Linux, OpenBSD, and Solaris. -------------------- */
    return (size_t)sysconf( _SC_PHYS_PAGES ) *
        (size_t)sysconf( _SC_PAGESIZE );

#elif defined(_SC_PHYS_PAGES) && defined(_SC_PAGE_SIZE)
    /* Legacy. -------------------------------------------------- */
    return (size_t)sysconf( _SC_PHYS_PAGES ) *
        (size_t)sysconf( _SC_PAGE_SIZE );

#elif defined(CTL_HW) && (defined(HW_PHYSMEM) || defined(HW_REALMEM))
    /* DragonFly BSD, FreeBSD, NetBSD, OpenBSD, and OSX. -------- */
    int mib[2];
    mib[0] = CTL_HW;
#if defined(HW_REALMEM)
    mib[1] = HW_REALMEM;        /* FreeBSD. ----------------- */
#elif defined(HW_PYSMEM)
    mib[1] = HW_PHYSMEM;        /* Others. ------------------ */
#endif
    unsigned int size = 0;      /* 32-bit */
    size_t len = sizeof( size );
    if ( sysctl( mib, 2, &size, &len, NULL, 0 ) == 0 )
        return (size_t)size;
    return 0L;          /* Failed? */
#endif /* sysctl and sysconf variants */

#else
    return 0L;          /* Unknown OS. */
#endif
}
```

The important line is

```c
 return (size_t)sysconf( _SC_PHYS_PAGES ) *
        (size_t)sysconf( _SC_PAGESIZE );
```

One thing to notice in the routine for competing for memory is we used ```fflush``` after the ```printf```. The purpose of ```fflush(stream)``` is to make the operating system flush any buffers to the underlying file. This mainly because stdout is buffered. The buffer is not flushed until newline. ```fflush``` will cause this process to happen with the absense of newline. stderr is unbuffered and thus fflush  would not be necessary.

For this experiment, we tested it on a VM. The reason is because the contending process will take all RAM and completely hault the mahcine if tested on the host. To ensure our VM has enough swap space, we follow this [tutorial](https://wiki.crowncloud.net/?adding_swap_kvm) to create 4GB of swap area (we allocated 2GB RAM for VM).

One thing we observe is that the execution time of the program become significantly longer to run. In our experiement we need to limit the number of iterations from 1 << 20 to 1 << 8 to get some sensible results without running for days.

When we use PRIVATE and ANONYMUS option and random access turned on, the misses in data TLB is 335009(std dev 7298). We can't get access to L1 cache data because it will cause the session to be automatically logged out whenever L1D is used. here are some interesting things to notice:

* *MAP_PRIVATE + MAP_ANONYMOUS*: TLB misses:335009(std dev 17298)  
  minflt: 4220(std dev 231)  
  oublock: 8(std dev 4)  
  nivcsw: 19(10)
* *MAP_SHARED*: TLB misses:251284std dev 103292)  
  minflt: 2784(std dev 231)  
  majflt: 247(std 65)  
  oublock: 18200(std dev 2987)  
  nivcsw: 8(7)

The most important difference here is that the oublock is much easier to trigger because the constant swapping. When file backed memory is used we also notice that majflt is much higher. Because pages are constantly traveling between swap area and memory, the page fault rate becomes a lot higher. The oublock also follows previous patterns as the file backed memory requires filesystem involvement.

Finally, we also modify the kernel's head (or more precisely its LRU page replacement algorithm). Look in ```mm/vmscan.c``` there's a function calleed ```shrink_page_list```. In it, you will see a switch statement with a PAGEREF_ACTIVATE case, which is the case where the kernel sees the page has been recently accessed. In this case the kernel gotos activate_locked, but you will change it to to do the same thing as the PAGEREF_RECLAIM case. We can simply move the case down and change its default behavior to direct to the PAGEREF_RECLAIM case. After that, we need to recompile the kernel for VM. We also summarize the most interesting results:

* *MAP_PRIVATE + MAP_ANONYMOUS*: TLB misses:308031(std dev 17298)  
  minflt: 4223(std dev 791)  
  oublock: 8(std dev 1)  
  nivcsw: 11(5)
* *MAP_SHARED*: TLB misses: 251284std dev 103292)  
  minflt: 2724(std dev 231)  
  majflt: 0(std 0)  
  oublock: 18200(std dev 2987)  
  nivcsw: 8(7)

We can see that the most of the pattern follow the previous result after the modified kernel is installed. One main difference is majflt value is reduced back down.
