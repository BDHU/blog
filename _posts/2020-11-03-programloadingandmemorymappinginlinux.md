---
layout: post
title: "Program Loading and Memory Mapping in Linux"
last_modified_at: 4 Dec, 2020
categories: "2020"
description: "The goal here is to familiarize yourself with how programs are loaded, dynamically paged, and some of the mechanics of signal handling and memory mapping in Linux.
"
tags: os kernel mm linux
comments: true
---

The goal here is to familiarize yourself with how programs are loaded, dynamically paged, and some of the mechanics of signal handling and memory mapping in Linux.
<!--description-->

## execve Syscall

The operating system, as one of itsd basic services, loads programs into memory for them to execute. Programs rely on ```execve``` syscall to get the OS to load the program into memory and start it executing as a process. The kernel version we used to testing is 5.4.0. Doing a quick search inside [Elixir](https://elixir.bootlin.com/linux/v5.4/source/fs/exec.c#L1956) gives us:

```c
SYSCALL_DEFINE3(execve,
		const char __user *, filename,
		const char __user *const __user *, argv,
		const char __user *const __user *, envp)
{
	return do_execve(getname(filename), argv, envp);
}
```

Follow the function call, we will eventually reach the call to ```__do_execve_file```, the comment of this function says "sys_execve() executes a new program", which is pretty straighforward. This function first checks the ```filename``` pointer. Then it checks the flags of the current process that limit of running processes is not exceeded:

```c
if (IS_ERR(filename))
		return PTR_ERR(filename);

/*
 * We move the actual failure in case of RLIMIT_NPROC excess from
 * set*uid() to execve() because too many poorly written programs
 * don't check setuid() return code.  Here we additionally recheck
 * whether NPROC limit is still exceeded.
 */
if ((current->flags & PF_NPROC_EXCEEDED) &&
    atomic_read(&current_user()->processes) > rlimit(RLIMIT_NPROC)) {
    retval = -EAGAIN;
    goto out_ret;
}

/* We're below the limit (still or again), so we don't want to make
    * further execve() calls fail. */
current->flags &= ~PF_NPROC_EXCEEDED;
```

The next important task is to allocate the ```struct linux_binprm``` structure defined [here](https://elixir.bootlin.com/linux/v5.4/source/include/linux/binfmts.h#L17). This structure is used to hold the arguments that are used when loading binaries.

```c
bprm = kzalloc(sizeof(*bprm), GFP_KERNEL);
	if (!bprm)
		goto out_files;
```

Next, the function performs a seireis of tasks to prepare the ```bprm``` struct. Refer to the [linux-insides](https://0xax.gitbooks.io/linux-insides/content/SysCall/linux-syscall-4.html) book to find more information on how exactly the ```bprm``` structure is filled up.  

The most important function called by ```__do_execve_file``` is ```search_binary_handler```. Based on the [comment](https://elixir.bootlin.com/linux/v5.4/source/fs/exec.c), this function cycles the list of binary formats handler, until one recognizes the image. We can find one section of the code surrounded by ```binfmt_lock```:

```c
list_for_each_entry(fmt, &formats, lh) {
    if (!try_module_get(fmt->module))
        continue;
    read_unlock(&binfmt_lock);

    bprm->recursion_depth++;
    retval = fmt->load_binary(bprm);
    bprm->recursion_depth--;

    read_lock(&binfmt_lock);
    put_binfmt(fmt);
    if (retval < 0 && !bprm->mm) {
        /* we got to flush_old_exec() and failed after it */
        read_unlock(&binfmt_lock);
        force_sigsegv(SIGSEGV);
        return retval;
    }
    if (retval != -ENOEXEC || !bprm->file) {
        read_unlock(&binfmt_lock);
        return retval;
    }
}
```

We can see it calls into ```load_binary```:

```c
retval = fmt->load_binary(bprm);
```

Here, the ```load_binary``` is a pointer in a ```linux_binfmt``` struct. For elf format, it can be found [here](https://elixir.bootlin.com/linux/v5.4/source/fs/binfmt_elf.c#L94):

```c
static struct linux_binfmt elf_format = {
	.module		= THIS_MODULE,
	.load_binary	= load_elf_binary,
	.load_shlib	= load_elf_library,
	.core_dump	= elf_core_dump,
	.min_coredump	= ELF_EXEC_PAGESIZE,
};
```

We can find the ```load_elf_binary``` function defined in the [```fs/binfmt_elf.c```](https://elixir.bootlin.com/linux/v5.4/source/fs/binfmt_elf.c#L673) file. Then the function will check the magic number in the ELF file header. You can find the ELF format from [wiki](https://en.wikipedia.org/wiki/Executable_and_Linkable_Format).
We can see for both 32-bit and 64-bit systems, the e-ident field should contain the magic number for ELF format files.

```c
/* Get the exec-header */
loc->elf_ex = *((struct elfhdr *)bprm->buf);

retval = -ENOEXEC;
/* First of all, some simple consistency checks */
if (memcmp(loc->elf_ex.e_ident, ELFMAG, SELFMAG) != 0)
    goto out;
```

Then, ```load_elf_binary``` will do some tasks to prepare for the executable file. After that, it will try to load the program header table:

```c
elf_phdata = load_elf_phdrs(&loc->elf_ex, bprm->file);
if (!elf_phdata)
    goto out;
```

Then it will traverse the program header table and find the interpreter which is responsible of setting up the stack and map elf binary into the correct location in memory. After the interpreter is obtained, the function will perform simple consistency checks on the interpreter. It will load the interpreter program headers:

```c
/* Load the interpreter program headers */
interp_elf_phdata = load_elf_phdrs(&loc->interp_elf_ex,
                    interpreter);
if (!interp_elf_phdata)
    goto out_free_dentry;
```

This function will call ```setup_arg_pages``` to finalize the stack vm_area_struct:
```c
/* Do this so that we can load the interpreter, if need be.  We will
    change some of these later */
retval = setup_arg_pages(bprm, randomize_stack_top(STACK_TOP),
                executable_stack);
if (retval < 0)
    goto out_free_dentry;
```



It will also mmap the elf image into the correct location in memory. The bss and brk sections are prepared for the executable file:

```c
/* Now we do a little grungy work by mmapping the ELF image into
    the correct location in memory. */
for(i = 0, elf_ppnt = elf_phdata;
    i < loc->elf_ex.e_phnum; i++, elf_ppnt++) {
        
        ...

        /* There was a PT_LOAD segment with p_memsz > p_filesz
           before this one. Map anonymous pages, if needed,
           and clear the area.  */
        retval = set_brk(elf_bss + load_bias,
                    elf_brk + load_bias,
                    bss_prot);
        if (retval)
            goto out_free_dentry;
        nbyte = ELF_PAGEOFFSET(elf_bss);
        if (nbyte) {
            nbyte = ELF_MIN_ALIGN - nbyte;
            if (nbyte > elf_brk - elf_bss)
                nbyte = elf_brk - elf_bss;
            if (clear_user((void __user *)elf_bss +
                        load_bias, nbyte)) {
            }
```

It will also call ```elf_map``` to map the segment to [vaddr, vaddr + file size] and align and then perform some checks:

```c
error = elf_map(bprm->file, load_bias + vaddr, elf_ppnt,
				elf_prot, elf_flags, total_size);
```

The interpreter is then loaded:

```c
elf_entry = load_elf_interp(&loc->interp_elf_ex,
                interpreter,
                &interp_map_addr,
                load_bias, interp_elf_phdata);
```

Finally, the elf talbe is created:

```c
retval = create_elf_tables(bprm, &loc->elf_ex,
            load_addr, interp_load_addr);
```

After everything is prepared, we can call the ```start_thread``` function, which prepares the new task's registers and segments for execution. We will pass the set of registers for the new task, the address of the entry point of the new task, and the address of the top of of the statck for the new task to this function.

```c
start_thread(regs, elf_entry, bprm->p);
```

A lot of the information here can also be found at the [linux-insides](https://0xax.gitbooks.io/linux-insides/content/SysCall/linux-syscall-4.html) book. I found it very helpful clearing my confusion.

In our own implementations, we will not call the loaded program's ```main``` function. Instead, our loader will transfer control to the entry point of the loaded program via the ```jmp``` instruction. It has two major differences:

* Jumping to the entry point indicates we are going to execute the glibc start up functions before main is called. This includes setting up thread local storge. ```main``` simply jump to the main with the loader's TLS, no other setups are involved.
* ```jmp``` doesn't push return address on stack. When the loaded prgoram finishes execution, it exits the loader program, instead of giving cntrol back to the caller.

<!-- ## Benchmarks

For all-at-once laoding, we will have our loader map the entire program. We will map an anonymous region for the program's bss. We had several problems during implementing the loader

* anonyumous mapping regions are not zeroed out
* mmap incorrect page alignment boundary
* Mixing 32-bit and 64-bit pointers from ```getauxv```.

It's also worth noting that every segment with ```PT_LOAD``` has to be mapped at the beginning.

The first thing we check here is to test wehther our loader is operating correctly. We first will print the arguments such as ```argc```, ```argv```, ```envp```, and the coresponding values inside ```argv``` to make sure that we pass them correctly to the stack. It will also allocate memory using ```malloc```. After the allocation succeeds, we will attemp to write contents into the allocated region to make sure our allocation actually works. We do this using the glibc function ```strcpy```. Then we will also read the contents we just wrote just to be certain. We will also attempt to allocate a bigger buffer using ```malloc``` to stress the capability. Finally, we will open ```/proc/self/maps``` and test whether the loader is mapped with correct addresses.

Another benchmark we used will write one bytes at a time on each mapped page in the first segment repeatedly. This will ensure that we can actually access the applciations's own mapping as well as the loader's mapping. We will perform an aggregation on each element we read and sum them up. This is to avoid the compiler from optimizing out the read-only code.

Another benchmark we used is for hybrid loader that stresses the ```bss``` region. Otherwise the access pattern  is pretty similar to benchmark 2. We will give more insights as we discuss about hyper loader.

Here is the code snippet showing how we print the ultimates results:

```c
static void show_result(void) {
    size_t buf_len = 50;
    char *cmd = (char *)malloc(buf_len);
    assert(cmd);
    sprintf(cmd, "cat /proc/%d/status", getpid());
    system(cmd);
    free(cmd);
}
```

## All-at-once Loading

This loader will map the entire program. We will map an anonymous region for the bss section. For the end-to-end execution time, we expect the first benchmark to be slightly slower than the second benchmark. It needs to map memory region using ```mmap``` without actually accessing too many of the mmap'd memory. Benchmark 2 should use slight less memory. However, it spends a lot of time trappingm thus it could have longer end-to-end execution time. Here is a graph illustrating the time comparison between the first and second benchmarks.
![b1](b1.jpeg)

all-at-once loader should consume more memory than the demand loader. We will also expect the second benchmark to have longer execution time. Here, we don't touch some pages in the all-at-once loader, theoretically, memory consumption should be slightly higher than the demand version. Then memory consumption comparison is shown here (The units are in *kb*):

![b2](b2.jpeg)

We can notice barely any differences here. The first benchmark only uses roughly 4 extra kb of memory compared the to second benchmark.

If the mmap'd segment is already owned, without ```MAP_FIXED``` flag, ```mmap``` will try to allocate another region. We can detect whether the loaded program is loading on top of the loader by checking the return address. An unmathc will simply caused abort. In effect, if we try to execute ```./all_ld all_ld```, we will see the following messsage, triggered by failed assertion check:

```text
all_ld: common.h:228: elf_map: Assertion `(map_addr == addr)
    && ((void *)map_addr != MAP_FAILED)' failed.
Aborted (core dumped)
```

## Demand Loading

For demand loading. What it means is we only map a single page of the executable under test. We will set up signal handlers to catch segmentation violations and any other signal we need. In the signal handler, we will determine what address the executable is trying to access, and only map that page. We will perform the same set of benchmarks on this loader. At the beginning, we will load only the page of the program's entry point. We will register signal handler with ```SIGSEGV``` to check whether is ine the elf segment range. The end-to-end performances is shown here:

![p3](p3.jpeg)

As we expect, the demand loader has reduced exectution, indicating mmap is time-consuming. For the memory consumption, we can see the results:

![p4](p4.jpeg)

The demand loader, as expected, consumed less memory in the first benchmark. The second benchmarks shows larger reduction on memory consumption, not as much as the reduction in execution time though. The time reduction should further reduce if we access more pages. Signal handling also consumes more time. In the end, both benchmarks use less memory, the secibd benchmark runs faster on apger.

If we use the provided code snippet:

```c
int
main() {
   int *zero = NULL;
   return *zero;
}
```

The loader will find it's the range of valid self segment. ```SIGSEGV``` will be thrown. We check whether if the faulting address is in some elf segment, segfault for non-matching.

## Hybrid Loader

If we can potentially map two apges, we can prefetch the next page if it lies in the same segment. If the next page is already mapped, no further action will taken. For ssequential access pattern, prefetching can dramatically imrpove the performance for page fault overhead. We can take the advantage of locality here. We can always fetch two pages at a time and all fetched pages can be accesseds, potentially reducing overhead.

We can potentially improve from two pages if we can take advantage of access patterns. The end-to-end performance and memory consumption is shown here:

![Overhead](p5.jpeg)

![Memory](p6.jpeg)

The hybrid loader behaves somewhere between the all-at-once and demand version. The time for both takss are slight reduced. The time difference are still large, the memory consumption is similar to all-at-once version. In addition, we write a new benchmark that sequentially access the ```bss``` region. We expect the prefetching algorithm top be faster for locality reasons. The end-to-end result is shown here (we use no hybrid version as a reference): 

![Overhead](p7.jpeg) -->
