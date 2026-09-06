using k_config_center.Infrastructure;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace k_config_center.Tests;

/// <summary>公共小工具单元测试：md5 计算、操作人提取、唯一冲突识别</summary>
public class OperationHelperTests
{
    [Theory]
    [InlineData(null, "d41d8cd98f00b204e9800998ecf8427e")]      // null 视为空串
    [InlineData("", "d41d8cd98f00b204e9800998ecf8427e")]
    [InlineData("hello", "5d41402abc4b2a76b9719d911017c592")]   // 已知向量
    public void ComputeMd5_结果为32位小写(string? content, string expected) =>
        Assert.Equal(expected, OperationHelper.ComputeMd5(content));

    [Fact]
    public void GetOperator_无请求头时缺省system()
    {
        var context = new DefaultHttpContext();

        Assert.Equal("system", OperationHelper.GetOperator(context.Request));
    }

    [Fact]
    public void GetOperator_携带XOperator头时取头值()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Operator"] = "alice";

        Assert.Equal("alice", OperationHelper.GetOperator(context.Request));
    }

    [Fact]
    public void IsUniqueViolation_普通异常返回false()
    {
        // 收紧后不做消息文本匹配：消息里恰好含 23505 的异常不应被误判为唯一冲突
        Assert.False(OperationHelper.IsUniqueViolation(new Exception("timeout after 23505 ms")));
    }

    [Fact]
    public void IsUniqueViolation_嵌套异常链逐层识别()
    {
        var wrapped = new InvalidOperationException("外层包装", new Exception("inner"));

        Assert.False(OperationHelper.IsUniqueViolation(wrapped));
    }
}
